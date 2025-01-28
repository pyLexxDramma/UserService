const { DataTypes } = require('sequelize');
const sequelize = require('../server').sequelize;

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
});

module.exports = Role;