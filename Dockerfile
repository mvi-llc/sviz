# Build stage
FROM node:16 as build
WORKDIR /src
COPY . ./

RUN corepack enable
RUN yarn install --immutable

RUN yarn run web:build:prod

# Release stage
FROM caddy:2.6.4-alpine
WORKDIR /src
COPY --from=build /src/web/.webpack ./

EXPOSE 80

COPY <<EOF /entrypoint.sh
# Optionally override the default layout with one provided via bind mount
mkdir -p /foxglove
touch /foxglove/default-layout.json
index_html=\$(cat index.html)
replace_pattern='/*FOXGLOVE_STUDIO_DEFAULT_LAYOUT_PLACEHOLDER*/'
replace_value=\$(cat /foxglove/default-layout.json)
echo "\${index_html/"\$replace_pattern"/\$replace_value}" > index.html

# Optionally set the extensions manifest via bind mount
if [ -f /src/extensions/manifest.json ]; then
  extensions_json=\$(cat /src/extensions/manifest.json)
  replace_pattern='/*FOXGLOVE_STUDIO_EXTENSIONS_PLACEHOLDER*/'
  echo "\${index_html/"\$replace_pattern"/\$extensions_json}" > index.html
fi

# Continue executing the CMD
exec "\$@"
EOF

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["caddy", "file-server", "--listen", ":80"]
