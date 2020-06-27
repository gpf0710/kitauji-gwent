var SortedSet = require('redis-sorted-set');

let instance_;

class Cache {
  constructor() {
    // ranking based on win count
    this.winRanking = new SortedSet();
    this.conditions = {};
  }

  static getInstance() {
    if (!instance_) instance_ = new Cache();
    return instance_;
  }

  async initialize() {
    let allUser = await db.getAllUser();
    for (let user of allUser) {
      if (!user.winCount) continue;
      this.winRanking.set(user.username, -user.winCount);
    }
  }

  async getCondition(username, conditionKey, opt_defaultValue) {
    this.conditions[username] = this.conditions[username] || {};
    let condition = this.conditions[username][conditionKey];
    if (condition != null) {
      return condition;
    }
    condition = this.conditions[username][conditionKey] = await db.getCondition(username, conditionKey);
    return condition != null ? conditionKey : opt_defaultValue;
  }

  async setCondition(username, conditionKey, value) {
    this.conditions[username] = this.conditions[username] || {};
    this.conditions[username][conditionKey] = value;
    await db.setCondition(username, conditionKey, value);
  }

  async recordUserWin(username, isWin) {
    await db.recordUserWin(username, isWin);
    if (isWin) {
      // zset sort in ascent order, store winCount * -1 
      this.winRanking.set(username, (this.winRanking.get(username) || 0) - 1);
    }
  }

  getUserRank(username) {
    return this.winRanking.rank(username);
  }

  async getTopK(k) {
    let topKUsers = this.winRanking.range(0, k);
    let userModels = await db.findUserByNames(topKUsers);
    userModels.sort((a, b) => {
      if (a.winCount > b.winCount) return -1;
      else if (a.winCount < b.winCount) return 1;
      if (a.loseCount < b.loseCount) return -1;
      else if (a.loseCount > b.loseCount) return 1;
      return 0;
    });
    return userModels;
  }
}

module.exports = Cache;
