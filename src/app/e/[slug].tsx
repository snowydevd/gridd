import { Redirect, useLocalSearchParams } from 'expo-router';

// Destino de los links compartidos (https://gridd.app/e/<slug>) cuando abren la app: van a la ficha.
export default function EventLinkScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={{ pathname: '/event/[id]', params: { id: slug } }} />;
}
