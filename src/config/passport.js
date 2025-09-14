import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './env.js';
import { findOrCreateByGoogleProfile } from '../models/user.model.js';

passport.use(new GoogleStrategy(
  {
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackURL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName || null;

      const user = await findOrCreateByGoogleProfile({ name, email });
      // normaliza a un objeto plano para el controller
      return done(null, { id: user.id, name: user.name, email: user.email });
    } catch (err) {
      done(err);
    }
  }
));

export default passport;
