const passport = require('passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
};

passport.use(new Strategy(opts, async (jwt_payload, done) => {
    try {
        const user = await User.findByPk(jwt_payload.id);
        return user ? done(null, user) : done(null, false);
    } catch (error) {
        return done(error, false);
    }
}));
