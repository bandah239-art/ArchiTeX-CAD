import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export interface SitePhoto {
  uri: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  project_id: string;
  element_tag: string;
  phase_tag: string;
  description: string;
  weather: string;
  uploaded: boolean;
}

export async function captureGeoTaggedPhoto(projectId: string): Promise<SitePhoto | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const photo = await ImagePicker.launchCameraAsync({ quality: 0.85, exif: true });
  if (photo.canceled || !photo.assets[0]) return null;

  const compressed = await ImageManipulator.manipulateAsync(
    photo.assets[0].uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: compressed.uri,
    timestamp: new Date().toISOString(),
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude ?? 0,
    accuracy: position.coords.accuracy ?? 0,
    project_id: projectId,
    element_tag: '',
    phase_tag: 'During',
    description: '',
    weather: '',
    uploaded: false,
  };
}
