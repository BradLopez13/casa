// The app's entry: expo-router's own (expo-router/entry-classic), with the root wrapped in
// OneRoot so two copies of it never run at once after an Android activity recreation.
// `@expo/metro-runtime` must be the first import, for Fast Refresh.
import '@expo/metro-runtime';

import { createElement } from 'react';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { OneRoot } from './ui/components/OneRoot';

function Root() {
  return createElement(OneRoot, null, createElement(App));
}

renderRootComponent(Root);
