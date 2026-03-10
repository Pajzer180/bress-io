(function () {
  // Zapisujemy referencję do currentScript w momencie parsowania,
  // bo wewnątrz callbacków (load, fetch) jest już null.
  var currentScript = document.currentScript;

  window.addEventListener('load', function () {
    try {
      var clientId = currentScript
        ? currentScript.getAttribute('data-client-id')
        : null;

      if (!clientId) {
        console.error('[Bress.io] Brak atrybutu data-client-id na tagu <script>.');
        return;
      }

      fetch(
        'http://localhost:3000/api/active-actions?clientId=' +
          encodeURIComponent(clientId),
      )
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Błąd HTTP: ' + response.status);
          }
          return response.json();
        })
        .then(function (actions) {
          if (!Array.isArray(actions)) {
            console.error(
              '[Bress.io] Odpowiedź API nie jest tablicą. Otrzymano:',
              actions,
            );
            return;
          }

          actions.forEach(function (action) {
            try {
              if (!action.selector) {
                console.error('[Bress.io] Akcja bez selektora:', action);
                return;
              }

              if (action.type === 'replace_text') {
                var el = document.querySelector(action.selector);
                if (!el) {
                  console.error(
                    '[Bress.io] Nie znaleziono elementu dla selektora:',
                    action.selector,
                  );
                  return;
                }
                el.textContent = action.value;
              } else if (action.type === 'replace_meta') {
                var metaEl = document.querySelector(action.selector);
                if (!metaEl) {
                  console.error(
                    '[Bress.io] Nie znaleziono meta elementu dla selektora:',
                    action.selector,
                  );
                  return;
                }
                var attrName = action.attribute || 'content';
                metaEl.setAttribute(attrName, action.value);
              } else {
                console.error(
                  '[Bress.io] Nieznany typ akcji:',
                  action.type,
                );
              }
            } catch (err) {
              console.error(
                '[Bress.io] Błąd podczas wdrażania akcji:',
                action,
                err,
              );
            }
          });
        })
        .catch(function (err) {
          console.error(
            '[Bress.io] Błąd podczas pobierania optymalizacji:',
            err,
          );
        });
    } catch (err) {
      console.error('[Bress.io] Nieoczekiwany błąd w snippecie:', err);
    }
  });
})();
