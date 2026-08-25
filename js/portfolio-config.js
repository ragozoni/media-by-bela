/* portfolio-config.js
   -----------------------------------------------------------------
   Aqui fica todo o conteúdo do portfólio, organizado por aba e por
   cliente. Troque os placeholders pelas artes reais quando tiver:

   - client: nome do cliente
   - meta:   categoria/descrição curta (aparece ao lado do nome)
   - items:  lista de artes desse cliente
       - image:   caminho da imagem (ex: "../assets/portfolio/cliente1.jpg")
                  deixe null para mostrar o placeholder "em breve"
       - caption: legenda curta opcional (some se vazio)
       - slides:  (só carrosséis) número de telas do carrossel

   Basta editar este arquivo — o HTML e o JS não precisam ser tocados.
   ----------------------------------------------------------------- */

const PORTFOLIO_DATA = {

    estaticos: [
        {
            client: "Nome do Cliente",
            meta: "Categoria · Descrição breve",
            items: [
                { image: null, caption: "#" },
                { image: null, caption: "" },
                { image: null, caption: "" }
            ]
        },
        {
            client: "Nome do Cliente",
            meta: "Categoria · Descrição breve",
            items: [
                { image: null, caption: "" },
                { image: null, caption: "" }
            ]
        }
    ],

    carrosseis: [
        {
            client: "Nome do Cliente",
            handle: "#",
            meta: "Categoria · Descrição breve",
            items: [
                {
                    images: [
                        null,
                        null,
                    ],
                caption: "Gammajack"
                },
            ]
        }
    ],

    stories: [
        {
            client: "Nome do Cliente",
            handle: "#",
            meta: "Categoria · Descrição breve",
            items: [
                { image: null, caption: "" }
            ]
        }
    ]

};
