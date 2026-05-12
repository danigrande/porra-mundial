const fs = require('fs');
const path = require('path');

// Obtener la nueva versión de los argumentos pasados por release-it
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Error: No se proporcionó la nueva versión al script sync-expo-version.js');
  process.exit(1);
}

const appJsonPath = path.join(__dirname, '..', 'app.json');

try {
  // Leer app.json
  const rawData = fs.readFileSync(appJsonPath, 'utf8');
  const appData = JSON.parse(rawData);

  console.log(`Actualizando app.json a la versión ${newVersion}...`);

  // Actualizar la versión semántica principal
  appData.expo.version = newVersion;

  // Asegurar que las estructuras ios y android existan
  if (!appData.expo.ios) appData.expo.ios = {};
  if (!appData.expo.android) appData.expo.android = {};

  // Incrementar ios.buildNumber (Asume que es un número o string numérico)
  const currentIosBuild = parseInt(appData.expo.ios.buildNumber || '0', 10);
  appData.expo.ios.buildNumber = (currentIosBuild + 1).toString();

  // Incrementar android.versionCode (Asume que es un número)
  const currentAndroidVersionCode = parseInt(appData.expo.android.versionCode || 0, 10);
  appData.expo.android.versionCode = currentAndroidVersionCode + 1;

  // Guardar app.json con formato
  fs.writeFileSync(appJsonPath, JSON.stringify(appData, null, 2) + '\n');

  console.log(`✅ app.json actualizado correctamente.`);
  console.log(`   - Versión: ${newVersion}`);
  console.log(`   - iOS Build: ${appData.expo.ios.buildNumber}`);
  console.log(`   - Android Version Code: ${appData.expo.android.versionCode}`);

} catch (error) {
  console.error('Error al sincronizar las versiones con Expo:', error.message);
  process.exit(1);
}
