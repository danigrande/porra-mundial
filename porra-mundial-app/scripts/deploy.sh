#!/bin/bash

# ==============================================================================
# 🚀 SCRIPT DE DESPLIEGUE AUTOMÁTICO DE MOBILE (EAS BUILD)
# ==============================================================================
# Ejecutar desde la raíz de porra-mundial-app:
#   bash scripts/deploy.sh
# ==============================================================================

set -e

# Colores para la terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}⚽ Iniciando preparación para producción de Porra Mundial 2026 Mobile...${NC}"

# 1. Asegurar dependencias al día
echo -e "${YELLOW}📦 Comprobando dependencias...${NC}"
npm install

# 2. Seleccionar entorno de compilación
echo -e "\n${BLUE}¿Dónde deseas compilar la aplicación?${NC}"
echo "1) Localmente en tu MacBook (Gratuito, rápido y sin colas. Usa tu Xcode local)"
echo "2) En la nube de Expo (EAS Cloud)"
read -p "Selecciona una opción (1 o 2): " BUILD_ENV

BUILD_ARGS=""
if [ "$BUILD_ENV" == "1" ]; then
    BUILD_ARGS="--local"
    echo -e "${GREEN}✓ Configurado para compilar localmente con tu Xcode y Android SDK.${NC}"
else
    echo -e "${GREEN}✓ Configurado para compilar en la nube de Expo (EAS Cloud).${NC}"
fi

# 3. Seleccionar auto-envío a tiendas
echo -e "\n${BLUE}¿Deseas subir automáticamente los binarios compilados a App Store y Google Play?${NC}"
read -p "(s/n): " AUTO_SUBMIT

if [[ "$AUTO_SUBMIT" =~ ^[Ss]$ ]]; then
    if [ "$BUILD_ENV" == "1" ]; then
        # En compilaciones locales no podemos pasar --auto-submit al comando build.
        # En su lugar, ejecutamos eas submit por separado después de terminar.
        echo -e "${GREEN}✓ Configurado para subir a las tiendas una vez finalizada la compilación local.${NC}"
    else
        BUILD_ARGS="$BUILD_ARGS --auto-submit"
        echo -e "${GREEN}✓ Configurado para subir automáticamente tras compilar en la nube.${NC}"
    fi
else
    echo -e "${YELLOW}! Las compilaciones se guardarán localmente/en Expo, pero no se subirán a las tiendas.${NC}"
fi

# 4. Lanzar compilación
echo -e "\n${BLUE}🏗️ Iniciando proceso de compilación (iOS y Android)...${NC}"
npx eas-cli build --platform all --profile production $BUILD_ARGS

# 5. Si fue compilación local y se solicitó subir, ejecutar el submit por separado
if [ "$BUILD_ENV" == "1" ] && [[ "$AUTO_SUBMIT" =~ ^[Ss]$ ]]; then
    echo -e "\n${BLUE}📤 Enviando binarios locales a las tiendas (EAS Submit)...${NC}"
    npx eas-cli submit --platform all
fi

echo -e "\n${GREEN}🎉 Proceso completado con éxito!${NC}"
