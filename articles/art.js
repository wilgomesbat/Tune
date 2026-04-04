// Aguarda o HTML carregar completamente
document.addEventListener('DOMContentLoaded', () => {
    
    // Seleciona todos os cabeçalhos de acordeão
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    // Adiciona o evento de clique a cada um
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            
            // Encontra o item pai (o bloco inteiro)
            const parentItem = header.parentElement;

            // Fecha outros acordeões abertos para um visual mais limpo (comportamento profissional)
            document.querySelectorAll('.accordion-item').forEach(item => {
                if (item !== parentItem && item.classList.contains('open')) {
                    item.classList.remove('open');
                }
            });

            // Alterna a classe 'open' no item clicado
            parentItem.classList.toggle('open');
            
            // Alongando a lógica: Adiciona log para debug profissional
            if (parentItem.classList.contains('open')) {
                console.log(`Accordion "${header.querySelector('.title-text').innerText}" aberto.`);
            }
        });
    });
});