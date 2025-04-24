const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'username' }, async (username, password, done) => {
      try {
        // Find user by username
        const user = await User.findOne({ username });
        
        // If user doesn't exist
        if (!user) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Return user if authenticated
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );
  
  // User serialization for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  // User deserialization from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};