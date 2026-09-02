#!/bin/sh
set -e

SSL_DIR_CF="/etc/ssl/cloudflare"
SSL_DIR="/ssl"
CONF="/etc/nginx/conf.d/default.conf"

# Canonical pair — maps to __SSL_CERT__ / __SSL_KEY__ in https.conf
SSL_CERT_FILE="ssl-certificate.pem"
SSL_KEY_FILE="ssl-private.key"

pem_valid() {
  [ -f "$1" ] && [ -s "$1" ] && grep -q "BEGIN CERTIFICATE" "$1" 2>/dev/null
}

key_valid() {
  [ -f "$1" ] && [ -s "$1" ] && grep -q "BEGIN.*PRIVATE KEY" "$1" 2>/dev/null
}

find_cert() {
  for dir in "$SSL_DIR_CF" "$SSL_DIR"; do
    [ -d "$dir" ] || continue

    cert="$dir/$SSL_CERT_FILE"
    key="$dir/$SSL_KEY_FILE"
    if pem_valid "$cert" && key_valid "$key"; then
      echo "$cert|$key"
      return 0
    fi

    for pair in "origin.pem origin.key" "cloudflare-origin.pem cloudflare-origin.key" "cert.pem key.pem" "origin.crt origin.key"; do
      set -- $pair
      cert="$dir/$1"
      key="$dir/$2"
      if pem_valid "$cert" && key_valid "$key"; then
        echo "$cert|$key"
        return 0
      fi
    done
  done
  return 1
}

if result="$(find_cert)"; then
  cert="${result%%|*}"
  key="${result#*|}"
  echo "proxy: SSL cert found — HTTPS enabled"
  echo "  cert (__SSL_CERT__): $cert"
  echo "  key  (__SSL_KEY__):  $key"
  sed "s|__SSL_CERT__|$cert|g; s|__SSL_KEY__|$key|g" /etc/nginx/templates/https.conf > "$CONF"
else
  echo "proxy: no valid SSL files — HTTP only on port 80"
  echo "  place PEM in: $SSL_DIR/$SSL_CERT_FILE + $SSL_DIR/$SSL_KEY_FILE"
  cp /etc/nginx/templates/http.conf "$CONF"
fi

exec nginx -g "daemon off;"
