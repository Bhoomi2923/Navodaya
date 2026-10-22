// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Folders Metro doesn't need to watch: generator scripts + their preview
// output, scratch dirs, and legacy galaxy PNGs that nothing imports.
// Patterns are anchored to the project root so node_modules is untouched.
const root = __dirname.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
const under = (rel) => new RegExp(`${root}[\\\\/]${rel}`);

config.resolver.blockList = [
  under('scripts[\\\\/]'),
  under('\\.tmp-preview[\\\\/]'),
  under('\\.sf[\\\\/]'),
  under('assets[\\\\/]images[\\\\/](galaxy-spiral|galaxy-elliptical|galaxy-cluster)\\.png$'),
  under('assets[\\\\/]images[\\\\/]spiral-galaxy\\.jpg$'),
];

module.exports = config;
