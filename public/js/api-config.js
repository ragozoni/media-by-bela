/* api-config.js
   -----------------------------------------------------------------
   URL base da API. Como o nginx faz proxy de /api e /uploads pro
   backend (ver nginx/nginx.conf), o site e a API vivem na mesma
   origem — por isso o valor fica vazio (caminho relativo funciona).

   Se um dia o backend for hospedado separado (outro domínio), troque
   aqui para algo como "https://api.seudominio.com".
   ----------------------------------------------------------------- */
const API_BASE = "";
