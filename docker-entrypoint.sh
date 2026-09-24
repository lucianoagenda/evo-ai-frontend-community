#!/bin/sh
set -e

# =============================================================================
# Runtime environment variable injection for Vite-built apps
# =============================================================================
# Replaces placeholder values in the built JS files with actual environment
# variables at container startup, enabling runtime configuration without
# rebuilding the image.
# =============================================================================

HTML_DIR="/usr/share/nginx/html"

# Replace VITE_* variables in all JS files
# The build uses empty strings or defaults — we replace them at runtime
for file in $(find "$HTML_DIR" -name '*.js' -type f); do
  # Replace each VITE_* env var if set
  [ -n "$VITE_API_URL" ] && sed -i "s|VITE_API_URL_PLACEHOLDER|${VITE_API_URL}|g" "$file"
  [ -n "$VITE_AUTH_API_URL" ] && sed -i "s|VITE_AUTH_API_URL_PLACEHOLDER|${VITE_AUTH_API_URL}|g" "$file"
  [ -n "$VITE_WS_URL" ] && sed -i "s|VITE_WS_URL_PLACEHOLDER|${VITE_WS_URL}|g" "$file"
  [ -n "$VITE_EVOAI_API_URL" ] && sed -i "s|VITE_EVOAI_API_URL_PLACEHOLDER|${VITE_EVOAI_API_URL}|g" "$file"
  [ -n "$VITE_AGENT_PROCESSOR_URL" ] && sed -i "s|VITE_AGENT_PROCESSOR_URL_PLACEHOLDER|${VITE_AGENT_PROCESSOR_URL}|g" "$file"
  [ -n "$VITE_EVOFLOW_API_URL" ] && sed -i "s|VITE_EVOFLOW_API_URL_PLACEHOLDER|${VITE_EVOFLOW_API_URL}|g" "$file"
done

# Configure nginx CSP based on environment (default: development)
# The CSP shipped in nginx.conf is the production default: img-src/media-src
# allow 'https:' (external buckets) but no plain-http origin. Chat media served
# by the backend (ActiveStorage local disk) comes from the API origin, which is
# plain http in development and in self-hosted deploys without TLS — without
# the adjustments below the browser blocks images/audio in the chat (EVO-1961).
# All substitutions are anchored on the trailing ';' or guarded so a container
# restart does not append the same source twice.
APP_ENV="${VITE_APP_ENV:-development}"
NGINX_CONF="/etc/nginx/conf.d/default.conf"

if [ "$APP_ENV" = "development" ]; then
  # Development: allow localhost (any port) for API calls and for media served
  # by the backend, and permissive frame-ancestors for the widget.
  sed -i \
    -e "s|connect-src 'self' blob: https: wss: ws:;|connect-src 'self' blob: https: wss: ws: http://localhost:*;|" \
    -e "s|img-src 'self' data: blob: https:;|img-src 'self' data: blob: https: http://localhost:*;|" \
    -e "s|media-src 'self' blob: https:;|media-src 'self' blob: https: http://localhost:*;|" \
    -e "s|frame-ancestors 'self';|frame-ancestors *;|" \
    "$NGINX_CONF"
fi

# Self-hosted over plain http (no TLS): media and API calls come from the API
# origin and 'https:' does not cover http origins, so allow it explicitly.
case "$VITE_API_URL" in
  http://*)
    API_ORIGIN="$(printf '%s' "$VITE_API_URL" | sed "s|^\(http://[^/]*\).*|\1|")"
    if ! grep -q "img-src[^;]* $API_ORIGIN" "$NGINX_CONF"; then
      sed -i \
        -e "s|\(img-src [^;]*\);|\1 ${API_ORIGIN};|" \
        -e "s|\(media-src [^;]*\);|\1 ${API_ORIGIN};|" \
        -e "s|\(connect-src [^;]*\);|\1 ${API_ORIGIN};|" \
        "$NGINX_CONF"
    fi
    ;;
esac

# =============================================================================
# [Traggi] Proxy seguro para a API do Traggi
# =============================================================================
# O navegador chama POST /traggi-api/crm_user_disable (same-origin). O nginx:
#   1. valida a sessão do usuário do CRM (auth_request no /api/v1/profile do
#      backend, com o mesmo Bearer token) — sem sessão válida, 401;
#   2. repassa para ${TRAGGI_API_URL}/api/crm_user_disable com o header Api-Key.
# A chave (TRAGGI_API_KEY) só existe no container; nunca vai para o bundle JS.
# Sem chave configurada, o endpoint responde 503 e nada é repassado.
TRAGGI_CONF_DIR="/etc/nginx/traggi"
TRAGGI_CONF="$TRAGGI_CONF_DIR/traggi.conf"
TRAGGI_API_URL="${TRAGGI_API_URL:-https://app.traggi.com.br}"
TRAGGI_API_URL="${TRAGGI_API_URL%/}"
# Backend usado para validar a sessão (padrão: o mesmo VITE_API_URL do CRM).
TRAGGI_AUTH_URL="${TRAGGI_AUTH_URL:-$VITE_API_URL}"
TRAGGI_AUTH_URL="${TRAGGI_AUTH_URL%/}"
mkdir -p "$TRAGGI_CONF_DIR"

traggi_disabled() {
  echo "[traggi] proxy desativado: $1" >&2
  cat > "$TRAGGI_CONF" <<'EOF'
location ^~ /traggi-api/ {
    default_type application/json;
    return 503 '{"error":"traggi_not_configured"}';
}
EOF
}

if [ -z "$TRAGGI_API_KEY" ]; then
  traggi_disabled "TRAGGI_API_KEY não definida"
elif ! printf '%s' "$TRAGGI_API_KEY" | grep -Eq '^[A-Za-z0-9._~+/=-]+$'; then
  traggi_disabled "TRAGGI_API_KEY contém caracteres não suportados"
elif ! printf '%s' "$TRAGGI_API_URL" | grep -Eq '^https?://[A-Za-z0-9.:-]+$'; then
  traggi_disabled "TRAGGI_API_URL inválida"
elif ! printf '%s' "$TRAGGI_AUTH_URL" | grep -Eq '^https?://[A-Za-z0-9.:/_-]+$'; then
  traggi_disabled "TRAGGI_AUTH_URL/VITE_API_URL inválida (necessária para validar a sessão)"
else
  # DNS resolvido em runtime (proxy_pass com variável) para que uma falha de DNS
  # não impeça o nginx de subir.
  RESOLVER="$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)"
  case "$RESOLVER" in *:*) RESOLVER="[$RESOLVER]" ;; esac
  RESOLVER="${RESOLVER:-8.8.8.8}"

  {
    printf 'location = /traggi-api/crm_user_disable {\n'
    printf '    limit_except POST { deny all; }\n'
    printf '    auth_request /_traggi_auth;\n'
    printf '    resolver %s valid=300s ipv6=off;\n' "$RESOLVER"
    printf '    set $traggi_upstream "%s";\n' "$TRAGGI_API_URL"
    printf '    proxy_ssl_server_name on;\n'
    printf '    proxy_set_header Api-Key "%s";\n' "$TRAGGI_API_KEY"
    printf '    proxy_set_header Content-Type "application/json";\n'
    printf '    proxy_set_header Authorization "";\n'
    printf '    proxy_set_header Cookie "";\n'
    printf '    client_max_body_size 1k;\n'
    printf '    proxy_pass $traggi_upstream/api/crm_user_disable;\n'
    printf '}\n\n'
    printf 'location = /_traggi_auth {\n'
    printf '    internal;\n'
    printf '    resolver %s valid=300s ipv6=off;\n' "$RESOLVER"
    printf '    set $traggi_auth_upstream "%s";\n' "$TRAGGI_AUTH_URL"
    printf '    proxy_ssl_server_name on;\n'
    printf '    proxy_method GET;\n'
    printf '    proxy_pass_request_body off;\n'
    printf '    proxy_set_header Content-Length "";\n'
    printf '    proxy_set_header Authorization $http_authorization;\n'
    printf '    proxy_pass $traggi_auth_upstream/api/v1/profile;\n'
    printf '}\n\n'
    printf 'location ^~ /traggi-api/ {\n'
    printf '    return 404;\n'
    printf '}\n'
  } > "$TRAGGI_CONF"
  echo "[traggi] proxy habilitado -> $TRAGGI_API_URL (sessão validada em $TRAGGI_AUTH_URL)" >&2
fi

exec "$@"
