import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme';

export const ONBOARDING_KEY = 'onboarding_done';

/** Entry gate: first run shows the intro slides, afterwards the tabs. */
export default function Index() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((done) => {
      setTarget(done ? '/(tabs)' : '/onboarding');
    });
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand[400]} />
      </View>
    );
  }
  return <Redirect href={target} />;
}
