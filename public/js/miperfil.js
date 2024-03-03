document.getElementById('iconoUsuario').addEventListener('click', function () {
    var navegacion = document.getElementById('navegacion');
    if (navegacion.style.display === 'none' || navegacion.style.display === '') {
        navegacion.style.display = 'block';
    } else {
        navegacion.style.display = 'none';
    }
});
