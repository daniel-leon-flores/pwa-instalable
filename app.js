// =====================================================================
// Inspección Visual PWA – app.js
// JavaScript Vanilla. Toda la asincronía se resuelve con promesas
// encadenadas: .then(), .catch() y .finally().
// =====================================================================

// ---------- Referencias al DOM ----------
const btnInstalar = document.getElementById('btn-instalar');
const btnPrepararCamara = document.getElementById('btn-preparar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');
const controlesCamara = document.getElementById('controles-camara');
const btnAlternarCamara = document.getElementById('btn-alternar-camara');
const btnApagarCamara = document.getElementById('btn-apagar-camara');
const visorVideo = document.getElementById('visor-camara');
const visorVacio = document.getElementById('visor-vacio');
const mensajeEstado = document.getElementById('mensaje-estado');
const estadoSW = document.getElementById('estado-sw');

// ---------- Estado global ----------
let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal

function actualizarMensajeEstado(texto) {
  mensajeEstado.textContent = texto;
}

function nombreCamara(modo) {
  return modo === 'environment' ? 'Trasera' : 'Frontal';
}

// =====================================================================
// FASE 1: Instalabilidad
// =====================================================================

// Registro del Service Worker (requisito de instalabilidad)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((registro) => {
        estadoSW.textContent = 'Service Worker activo · scope: ' + registro.scope;
      })
      .catch((error) => {
        estadoSW.textContent = 'Error al registrar el Service Worker: ' + error.message;
      });
  });
} else {
  estadoSW.textContent = 'Este navegador no soporta Service Workers.';
}

// Fragmento B: captura del evento de instalación
window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;

  // Muestra el botón personalizado de instalación en la UI
  btnInstalar.hidden = false;
});

// Desafío 1.2: botón de instalación propio
btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) {
    return;
  }

  btnInstalar.disabled = true;
  eventoInstalacionDiferido.prompt();

  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        btnInstalar.hidden = true;
        actualizarMensajeEstado('Instalación aceptada. Busca la app en tu pantalla de inicio.');
      } else {
        actualizarMensajeEstado('Instalación cancelada. Puedes instalarla más tarde.');
      }
    })
    .catch((error) => {
      actualizarMensajeEstado('No se pudo completar la instalación: ' + error.message);
    })
    .finally(() => {
      // El evento diferido solo se puede usar una vez
      eventoInstalacionDiferido = null;
      btnInstalar.disabled = false;
    });
});

// Si la app se instala (por nuestro botón o por el menú del navegador)
window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
});

// =====================================================================
// FASE 2: Acceso ético a la cámara
// =====================================================================

// Fragmento C: liberar el hardware antes de cambiar de cámara
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

// Sincroniza la interfaz con el estado real de la cámara
function actualizarInterfazCamara() {
  const camaraEncendida = streamActual !== null;

  controlesCamara.hidden = !camaraEncendida;
  btnPrepararCamara.hidden = camaraEncendida;
  visorVacio.hidden = camaraEncendida;

  // La cámara frontal se muestra en espejo
  visorVideo.classList.toggle('espejo', camaraEncendida && modoCamaraActual === 'user');

  btnAlternarCamara.textContent = modoCamaraActual === 'environment'
    ? 'Cambiar a Frontal'
    : 'Cambiar a Trasera';
}

// Fragmento D: encendido de cámara con promesas y diagnóstico de errores
function iniciarCamara(modo) {
  detenerCamaraActiva();

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      actualizarMensajeEstado(`Cámara activa (${nombreCamara(modo)})`);
    })
    .catch((error) => {
      visorVideo.srcObject = null;

      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    })
    .finally(() => {
      actualizarInterfazCamara();
    });
}

// Comprobación de soporte: getUserMedia solo existe en contextos seguros (HTTPS)
function camaraDisponible() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Fragmento E – Paso 1: el usuario expresa su intención -> mostramos el aviso.
// Aquí NO se llama a getUserMedia, por lo que el navegador aún no pregunta nada.
btnPrepararCamara.addEventListener('click', () => {
  if (!camaraDisponible()) {
    actualizarMensajeEstado('Tu navegador no permite el acceso a la cámara. Asegúrate de abrir la app con HTTPS.');
    return;
  }

  avisoPermiso.hidden = false;
  btnPrepararCamara.hidden = true;
  btnConfirmarPermiso.focus();
});

// Fragmento E – Paso 2: el usuario leyó el motivo y confirma -> ahora sí, permiso nativo
btnConfirmarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  btnConfirmarPermiso.disabled = true;
  actualizarMensajeEstado('Solicitando permiso al navegador…');

  iniciarCamara(modoCamaraActual)
    .finally(() => {
      btnConfirmarPermiso.disabled = false;
    });
});

// El usuario decide no continuar: nunca se mostró el diálogo nativo,
// así que el permiso NO queda bloqueado y podrá intentarlo después.
btnCancelarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  btnPrepararCamara.hidden = false;
  actualizarMensajeEstado('De acuerdo, la cámara sigue apagada.');
});

// Desafío 2.3: alternar entre cámara trasera y frontal
btnAlternarCamara.addEventListener('click', () => {
  const modoAnterior = modoCamaraActual;
  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';

  btnAlternarCamara.disabled = true;
  actualizarMensajeEstado(`Cambiando a cámara ${nombreCamara(modoCamaraActual)}…`);

  iniciarCamara(modoCamaraActual)
    .then(() => {
      // Si el lente solicitado no existe, regresamos al modo anterior
      if (!streamActual) {
        modoCamaraActual = modoAnterior;
        actualizarInterfazCamara();
      }
    })
    .finally(() => {
      btnAlternarCamara.disabled = false;
    });
});

// Desafío 2.4: apagar la cámara y liberar el sensor
btnApagarCamara.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarInterfazCamara();
  actualizarMensajeEstado('Cámara apagada. El sensor fue liberado.');
});

// Libera la cámara si el usuario cierra o abandona la página
window.addEventListener('pagehide', () => {
  detenerCamaraActiva();
});

// Estado inicial de la interfaz
actualizarInterfazCamara();
