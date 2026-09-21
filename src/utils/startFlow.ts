import { Alert } from 'react-native';

/**
 * Start a workout, or ask first if one is already going. The old behaviour
 * was a dead end ("finish or discard your current workout first"); now you
 * can carry on with the running one or replace it on the spot.
 */
export function startOrReplace(opts: {
  isWorkoutActive: boolean;
  discardWorkout: () => void;
  start: () => void;
  navigation: any;
}) {
  const go = () => {
    opts.start();
    opts.navigation.navigate('ActiveWorkout');
  };
  if (!opts.isWorkoutActive) {
    go();
    return;
  }
  Alert.alert(
    'A workout is already going',
    'Carry on with it, or replace it with this one? Replacing throws away anything logged so far.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Carry on', onPress: () => opts.navigation.navigate('ActiveWorkout') },
      {
        text: 'Replace it',
        style: 'destructive',
        onPress: () => {
          opts.discardWorkout();
          go();
        },
      },
    ],
  );
}
