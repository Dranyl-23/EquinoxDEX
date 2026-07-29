import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
} from 'react-native';
import { ShieldCheck, Zap, Sparkles } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';

const { width } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // 1. Continuous pulsing glow animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.35,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.8,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.9,
            duration: 1200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // 2. Entrance sequence
    Animated.sequence([
      // Logo Spring Entrance
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          bounciness: 10,
          speed: 12,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Text Slide Up + Fade In
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      // Progress Bar Fill
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false, // width animation
      }),
    ]).start(() => {
      // 3. Smooth Fade Out to App
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setIsDone(true);
        onFinish();
      });
    });
  }, []);

  if (isDone) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: splashOpacity }]}>
      {/* Background Decorative Rings */}
      <View style={styles.ringOuter}>
        <View style={styles.ringInner} />
      </View>

      {/* Center Logo with Pulsing Glow */}
      <View style={styles.centerSection}>
        <Animated.View
          style={[
            styles.glowRing,
            {
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoBadge}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 70, height: 70, borderRadius: 20 }} 
            />
          </View>
        </Animated.View>

        {/* Animated Brand Typography */}
        <Animated.View
          style={[
            styles.textSection,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>EQUINOX DEX</Text>

          <View style={styles.protocolBadge}>
            <ShieldCheck size={12} color={colors.brand} />
            <Text style={styles.protocolText}>SOROBAN MARGIN PROTOCOL</Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Loading Progress Bar */}
      <Animated.View style={[styles.footer, { opacity: textOpacity }]}>
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.loadingText}>Initializing Secured Enclave...</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07080c',
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: (width * 1.4) / 2,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.08)',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    elevation: 15,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  logoBadge: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    alignItems: 'center',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  protocolText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    width: width * 0.7,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: 2,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
