const express = require('express');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Database setup
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Export sequelize instance
module.exports = { sequelize };

// Models
const User = require('./models/User');
const Role = require('./models/Role');

// Associations
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });

// Controllers
const userController = require('./controllers/userController');
const roleController = require('./controllers/roleController');

// JWT Strategy Setup
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
};

passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    try {
        const user = await User.findOne({where: { id: jwtPayload.id }, include: 'role'});
        if (user) {
            return done(null, user);
        } else {
            return done(null, false);
        }
    } catch (error) {
        return done(error, false);
    }
}));

// Passport Setup
app.use(passport.initialize());

// Routes
app.get('/', (req, res) => {
  res.send('Hello World');
});

// User routes
app.post('/users', userController.createUser);
app.get('/users', passport.authenticate('jwt', { session: false }), userController.getUsers);
app.get('/users/:id', passport.authenticate('jwt', { session: false }), userController.getUserById);
app.put('/users/:id', passport.authenticate('jwt', { session: false }), userController.updateUser);
app.delete('/users/:id', passport.authenticate('jwt', { session: false }), userController.deleteUser);

// Защищенный маршрут для получения списка всех пользователей
app.get('/users', passport.authenticate('jwt', { session: false }), async (req, res) => {
    // Проверка роли пользователя
    if (req.user.role.name !== 'ROLE_ADMIN') { // Изменено на req.user.role.name
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Защищенный маршрут для получения информации о текущем пользователе
app.get('/me', passport.authenticate('jwt', { session: false }), async (req, res) => {
    res.status(200).json(req.user);
});

// Role routes
app.post('/roles', roleController.createRole);
app.get('/roles', roleController.getRoles);
app.get('/roles/:id', roleController.getRoleById);
app.put('/roles/:id', roleController.updateRole);
app.delete('/roles/:id', roleController.deleteRole);

// Регистрация пользователя
app.post('/signup', async (req, res) => {
    try {
        const {username, password} = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const defaultRole = await Role.findOne({ where: { name: 'ROLE_USER' } });
        if(!defaultRole) {
            return res.status(500).json({ error: 'default user role not found' });
        }
        const user = await User.create({
            username,
            password: hashedPassword,
            roleId: defaultRole.id
        });
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.log(error);
        res.status(400).json({ message: error.message });
    }
});

// Логин пользователя
app.post('/login', async (req, res) => {
    try {
        const {username, password} = req.body;
        const user = await User.findOne({ where: { username }, include: 'role'});
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, role: user.role.name }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Start server
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection successful');
        await sequelize.sync();
        // Create default roles if not exist
        const adminRole = await Role.findOrCreate({ where: { name: 'ROLE_ADMIN' }, defaults: { name: 'ROLE_ADMIN' } });
        const userRole = await Role.findOrCreate({ where: { name: 'ROLE_USER' }, defaults: { name: 'ROLE_USER' } });

        // Create admin and user if not exists
        const adminUser = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin',
                password: await bcrypt.hash('admin', 10),
                roleId: adminRole[0].id
            }
        });

        const defaultUser = await User.findOrCreate({
            where: {username: 'user'},
            defaults: {
                username: 'user',
                password: await bcrypt.hash('user', 10),
                roleId: userRole[0].id
            }
        });

        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
})();
