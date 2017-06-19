
function Registry() {
    this.usersById = {};
}

Registry.prototype.register = function (user) {
    this.usersById[user.id] = user;
};

Registry.prototype.unregister = function (id) {
    var user = this.getById(id);
    if (user)
        delete this.usersById[id];
};

Registry.prototype.getById = function (id) {
    return this.usersById[id];
};



Registry.prototype.removeById = function (id) {
    var user = this.usersById[id];
    if (!user)
        return;
    delete this.usersById[id];
};

Registry.prototype.getUsersByRoom = function (room) {
    var userList = this.usersById;
    var usersInRoomList = [];
    for (var i in userList) {
        if (userList[i].room === room) {
            usersInRoomList.push(userList[i]);
        }
    }

    return usersInRoomList;
};

module.exports = Registry;