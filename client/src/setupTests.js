require('@testing-library/jest-dom');

// Ace mode/theme side-effect imports expect a global ace object in test env.
global.ace = global.ace || {
  define: () => {},
  require: (_modules, callback) => {
    if (typeof callback === 'function') {
      callback({});
    }
    return {};
  },
};
