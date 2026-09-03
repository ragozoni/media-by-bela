# Imagem leve do nginx, só pra servir arquivos estáticos
FROM nginx:alpine

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Remove o conteúdo padrão do nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia o projeto inteiro preservando a estrutura de pastas
# (css/, html/, js/, details/), já que o HTML usa caminhos
# relativos como ../css/tokens.css — precisam continuar irmãs
COPY css/     /usr/share/nginx/html/css/
COPY js/      /usr/share/nginx/html/js/
COPY html/    /usr/share/nginx/html/html/
COPY index.html /usr/share/nginx/html/index.html

# Redireciona a raiz do site pra página de links,
# já que ela fica em /html/links_page.html
#RUN echo '<meta http-equiv="refresh" content="0; url=/html/links_page.html">' > /usr/share/nginx/html/index.html

RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
