import React from 'react';

import HomeHero from './HomeHero';

interface Props {
  topInset: number;
  firstName?: string | null;
  avatarUrl?: string | null;
  onProfilePress?: () => void;
}

/** Hero azul de marca fijo arriba del inicio (ZinApp + saludo + ubicación). */
export default function CustomerHomeHeader({
  topInset,
  firstName,
  avatarUrl,
  onProfilePress,
}: Props) {
  return (
    <HomeHero
      topInset={topInset}
      firstName={firstName}
      avatarUrl={avatarUrl}
      subtitle="Zinapécuaro, Mich."
      onProfilePress={onProfilePress}
    />
  );
}
