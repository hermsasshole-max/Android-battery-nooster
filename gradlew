#!/bin/sh

#
# Copyright © 2015-2021 the original authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

APP_BASE_NAME=`basename "$0"`
APP_HOME="`pwd -P`"

# Fallback: if gradle is available, use it directly
if command -v gradle >/dev/null 2>&1; then
    exec gradle "$@"
fi

# Execute standard java wrapper jar if present
CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar
if [ -f "$CLASSPATH" ]; then
    exec java -Xmx2048m -Dorg.gradle.appname="$APP_BASE_NAME" -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
fi

# Download gradle wrapper jar if missing
mkdir -p "$APP_HOME/gradle/wrapper"
WRAPPER_JAR="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
if [ ! -f "$WRAPPER_JAR" ]; then
    echo "Downloading Gradle wrapper jar..."
    curl -sLo "$WRAPPER_JAR" https://raw.githubusercontent.com/gradle/gradle/v8.11.1/gradle/wrapper/gradle-wrapper.jar || true
fi

if [ -f "$WRAPPER_JAR" ]; then
    exec java -Xmx2048m -Dorg.gradle.appname="$APP_BASE_NAME" -classpath "$WRAPPER_JAR" org.gradle.wrapper.GradleWrapperMain "$@"
fi

echo "Error: Could not locate gradle or gradle-wrapper.jar" >&2
exit 1
