(() => {
  "use strict";

  const saveButton =
    document.querySelector(
      "[data-profile-settings-save]"
    );

  const form =
    saveButton?.closest(
      ".profile-settings-form"
    )
    || saveButton?.closest(
      "form"
    );

  const dialog =
    document.querySelector(
      "[data-profile-save-confirm-dialog]"
    );

  const list =
    dialog?.querySelector(
      "[data-profile-save-confirm-list]"
    );

  const submitButton =
    dialog?.querySelector(
      "[data-profile-save-confirm-submit]"
    );

  const title =
    dialog?.querySelector(
      "[data-profile-save-confirm-title]"
    );

  const lead =
    dialog?.querySelector(
      "[data-profile-save-confirm-lead]"
    );

  const savedCloseButton =
    dialog?.querySelector(
      "[data-profile-save-confirm-saved-close]"
    );

  const savedMyArtLink =
    dialog?.querySelector(
      "[data-profile-save-confirm-saved-myart]"
    );

  const cancelButtons =
    dialog?.querySelectorAll(
      "[data-profile-save-confirm-cancel]"
    )
    || [];
  /* profile-save-overlay-api:start */
  const syncPopupViewport =
    () => {
      const height =
        window.visualViewport?.height
        || window.innerHeight;

      document.documentElement.style.setProperty(
        "--profile-save-popup-vh",
        `${Math.round(height)}px`
      );
    };

  const isConfirmOpen =
    () => !dialog.hidden;

  const openConfirmOverlay =
    () => {
      syncPopupViewport();
      dialog.hidden = false;
      document.body.classList.add(
        "profile-save-popup-open"
      );
    };

  const closeConfirmOverlay =
    () => {
      dialog.hidden = true;
      document.body.classList.remove(
        "profile-save-popup-open"
      );
    };

  syncPopupViewport();

  window.visualViewport?.addEventListener(
    "resize",
    syncPopupViewport
  );

  window.addEventListener(
    "resize",
    syncPopupViewport
  );
  /* profile-save-overlay-api:end */



  if(
    !saveButton
    || !form
    || !dialog
    || !list
    || !submitButton
  ){
    return;
  }

  document.body.classList.add(
    "profile-settings-has-floating-save"
  );

  saveButton.classList.add(
    "profile-settings-save-floating"
  );

  const findBottomNavigation =
    () => {
      const explicitSelectors = [
        "[data-footer-nav]",
        ".muuzee-footer-nav",
        ".footer-nav",
        ".bottom-nav",
        ".mobile-footer-nav",
        ".global-footer-nav",
        ".footer-menu",
        ".footer-fixed"
      ];

      for(
        const selector
        of explicitSelectors
      ){
        const element =
          document.querySelector(
            selector
          );

        if(element){
          return element;
        }
      }

      const candidates =
        Array.from(
          document.querySelectorAll(
            "nav,"
            + "footer,"
            + "[role='navigation'],"
            + "[class*='footer'],"
            + "[class*='bottom']"
          )
        )
          .map(
            element => ({
              element,
              rect:
                element
                  .getBoundingClientRect()
            })
          )
          .filter(
            ({rect}) =>
              rect.height >= 40
              && rect.height <= 220
              && rect.top
                > window.innerHeight * .5
              && rect.bottom
                >= window.innerHeight - 4
          )
          .sort(
            (a,b) =>
              b.rect.top
              - a.rect.top
          );

      return candidates[0]
        ?.element
        || null;
    };

  const syncFooterOffset =
    () => {
      const footer =
        findBottomNavigation();

      const rect =
        footer
          ?.getBoundingClientRect();

      const offset =
        rect
          ? Math.max(
              0,
              Math.ceil(
                window.innerHeight
                - rect.top
              )
            )
          : 96;

      document.documentElement
        .style.setProperty(
          "--profile-save-footer-offset",
          `${offset}px`
        );
    };

  syncFooterOffset();

  window.addEventListener(
    "resize",
    syncFooterOffset
  );

  const normalizeText =
    value =>
      String(
        value ?? ""
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

  const fieldLabelMap = [
    [/nick|display.?name|profile.?name/i,"ニックネーム"],
    [/email|mail.?address/i,"メールアドレス"],
    [/newsletter|mail.?mag/i,"メールマガジン"],
    [/notification|notice/i,"通知"],
    [/country|domestic|overseas/i,"居住地（国内 / 海外）"],
    [/region/i,"居住地（地方）"],
    [/prefecture/i,"居住地（都道府県）"],
    [/city|municipality/i,"居住地（市区町村）"],
    [/visibility|friend|searchable/i,"友だち検索"],
    [/artwall|my.?art|background|visual|style/i,"My Art表示"]
  ];

  const findFieldLabel =
    field => {
      const key =
        [
          field.name,
          field.id,
          field.dataset?.settingKey
        ]
          .filter(Boolean)
          .join(" ");

      for(
        const [pattern,label]
        of fieldLabelMap
      ){
        if(pattern.test(key)){
          return label;
        }
      }

      if(field.id){
        const label =
          document.querySelector(
            `label[for="${CSS.escape(field.id)}"]`
          );

        const labelText =
          normalizeText(
            label?.textContent
          );

        if(labelText){
          return labelText;
        }
      }

      const row =
        field.closest(
          ".profile-settings-row,"
          + ".profile-setting-row,"
          + ".profile-field,"
          + ".settings-row,"
          + ".profile-settings-item,"
          + ".profile-settings-control"
        );

      const rowLabel =
        row?.querySelector(
          ".profile-settings-label,"
          + ".profile-setting-label,"
          + ".settings-label,"
          + ".profile-settings-item-title,"
          + "label,"
          + "strong"
        );

      const rowText =
        normalizeText(
          rowLabel?.textContent
        );

      return (
        rowText
        || field.name
        || field.id
        || "設定"
      );
    };

  const readableValue =
    field => {
      if(
        field.type
        === "checkbox"
      ){
        return field.checked
          ? "オン"
          : "オフ";
      }

      if(
        field.type
        === "radio"
      ){
        if(!field.checked){
          return null;
        }

        return normalizeText(
          field.closest("label")
            ?.textContent
          || field.value
        );
      }

      if(
        field.tagName
        === "SELECT"
      ){
        return normalizeText(
          field.selectedOptions?.[0]
            ?.textContent
          || field.value
        );
      }

      return normalizeText(
        field.value
      );
    };

  const getAvatarSrc =
    () => {
      const image =
        document.querySelector(
          ".profile-avatar-upload img,"
          + "[data-avatar-preview]"
        );

      return image?.currentSrc
        || image?.src
        || "";
    };

  const getControlKey =
    (
      field,
      index
    ) => {
      if(
        field.type
        === "radio"
      ){
        return (
          field.name
          || field.id
          || `radio-${index}`
        );
      }

      return (
        field.name
        || field.id
        || field.dataset?.settingKey
        || `control-${index}`
      );
    };

  const collectState =
    () => {
      const state =
        new Map();

      Array.from(
        form.querySelectorAll(
          "input,select,textarea"
        )
      ).forEach(
        (
          field,
          index
        ) => {
          if(
            [
              "file",
              "button",
              "submit",
              "reset"
            ].includes(
              field.type
            )
          ){
            return;
          }

          if(
            field.type
            === "radio"
            && !field.checked
          ){
            return;
          }

          const value =
            readableValue(
              field
            );

          if(value === null){
            return;
          }

          const key =
            getControlKey(
              field,
              index
            );

          state.set(
            key,
            {
              label:
                findFieldLabel(
                  field
                ),
              value
            }
          );
        }
      );

      state.set(
        "__avatar__",
        {
          label:
            "プロフィール画像",
          value:
            getAvatarSrc()
        }
      );

      return state;
    };

  let initialState =
    new Map();

  const displayValue =
    (
      key,
      value
    ) => {
      if(
        key
        === "__avatar__"
      ){
        return value
          ? "設定済み"
          : "未設定";
      }

      return value || "未設定";
    };

  /* profile-save-confirm-dom-order:start */
  const getChangeDomOrder =
    key => {
      let element =
        null;

      if(
        key
        === "__avatar__"
      ){
        element =
          form.querySelector(
            ".profile-avatar-upload"
          );
      } else {
        const escaped =
          CSS.escape(
            String(key)
          );

        element =
          form.querySelector(
            `[name="${escaped}"]`
          )
          || form.querySelector(
            `#${escaped}`
          )
          || form.querySelector(
            `[data-setting-key="${escaped}"]`
          );
      }

      if(!element){
        return Number.MAX_SAFE_INTEGER;
      }

      const ordered =
        Array.from(
          form.querySelectorAll(
            ".profile-avatar-upload,"
            + "input,"
            + "select,"
            + "textarea"
          )
        );

      const index =
        ordered.indexOf(
          element
        );

      return index >= 0
        ? index
        : Number.MAX_SAFE_INTEGER;
    };
  /* profile-save-confirm-dom-order:end */

  const getChanges =
    () => {
      const current =
        collectState();

      const keys =
        new Set([
          ...initialState.keys(),
          ...current.keys()
        ]);

      const changes =
        [];

      keys.forEach(
        key => {
          const before =
            initialState.get(
              key
            );

          const after =
            current.get(
              key
            );

          const beforeValue =
            before?.value
            ?? "";

          const afterValue =
            after?.value
            ?? "";

          if(
            beforeValue
            === afterValue
          ){
            return;
          }

          changes.push({
            key,
            label:
              after?.label
              || before?.label
              || "設定",
            before:
              displayValue(
                key,
                beforeValue
              ),
            after:
              displayValue(
                key,
                afterValue
              )
          });
        }
      );

      return changes.sort(
        (
          a,
          b
        ) =>
          getChangeDomOrder(
            a.key
          )
          - getChangeDomOrder(
              b.key
            )
      );
    };

  const syncSaveState =
    () => {
      const hasChanges =
        getChanges()
          .length > 0;

      saveButton.disabled =
        !hasChanges;

      saveButton.setAttribute(
        "aria-disabled",
        hasChanges
          ? "false"
          : "true"
      );

      saveButton.dataset.hasChanges =
        hasChanges
          ? "true"
          : "false";
    };

  const captureInitialState =
    () => {
      initialState =
        collectState();

      syncSaveState();
    };

  requestAnimationFrame(
    () => {
      requestAnimationFrame(
        captureInitialState
      );
    }
  );

  const queueSaveStateSync =
    () => {
      syncSaveState();

      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            syncSaveState
          );
        }
      );
    };

  form.addEventListener(
    "input",
    queueSaveStateSync
  );

  form.addEventListener(
    "change",
    queueSaveStateSync
  );

  const avatarPreview =
    document.querySelector(
      ".profile-avatar-upload img,"
      + "[data-avatar-preview]"
    );

  avatarPreview?.addEventListener(
    "load",
    syncSaveState
  );

  const renderChanges =
    changes => {
      list.innerHTML =
        "";

      if(!changes.length){
        const empty =
          document.createElement(
            "p"
          );

        empty.className =
          "profile-save-confirm-empty";

        empty.textContent =
          "変更された項目はありません。";

        list.appendChild(
          empty
        );

        return;
      }

      const fragment =
        document.createDocumentFragment();

      changes.forEach(
        change => {
          const item =
            document.createElement(
              "div"
            );

          item.className =
            "profile-save-confirm-item";

          const label =
            document.createElement(
              "p"
            );

          label.className =
            "profile-save-confirm-label";

          label.textContent =
            change.label;

          const values =
            document.createElement(
              "div"
            );

          values.className =
            "profile-save-confirm-values";

          const before =
            document.createElement(
              "div"
            );

          before.className =
            "profile-save-confirm-before";

          before.textContent =
            change.before;

          const arrow =
            document.createElement(
              "span"
            );

          arrow.className =
            "profile-save-confirm-arrow";

          arrow.textContent =
            "→";

          const after =
            document.createElement(
              "div"
            );

          after.className =
            "profile-save-confirm-after";

          after.textContent =
            change.after;

          values.append(
            before,
            arrow,
            after
          );

          item.append(
            label,
            values
          );

          fragment.appendChild(
            item
          );
        }
      );

      list.appendChild(
        fragment
      );
    };

  const setConfirmState =
    () => {
      dialog.classList.remove(
        "is-saved"
      );

      if(title){
        title.textContent =
          "更新内容を確認";
      }

      if(lead){
        lead.textContent =
          "以下の内容を更新します。";
      }

      submitButton.hidden =
        false;

      cancelButtons.forEach(
        button => {
          button.hidden =
            false;
        }
      );

      if(savedCloseButton){
        savedCloseButton.hidden =
          true;
      }

      if(savedMyArtLink){
        savedMyArtLink.hidden =
          true;
      }
    };

  const setSavedState =
    () => {
      dialog.classList.add(
        "is-saved"
      );

      if(title){
        title.textContent =
          "保存しました";
      }

      if(lead){
        lead.textContent =
          "設定を保存しました。";
      }

      submitButton.hidden =
        true;

      cancelButtons.forEach(
        button => {
          button.hidden =
            true;
        }
      );

      if(savedCloseButton){
        savedCloseButton.hidden =
          false;
      }

      if(savedMyArtLink){
        savedMyArtLink.hidden =
          false;
      }
    };

  const closeConfirm =
    () => {
      if(isConfirmOpen()){
        closeConfirmOverlay();
      }
    };

  cancelButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeConfirm
      );
    }
  );

  dialog.addEventListener(
    "click",
    event => {
      if(
        event.target
        === dialog
      ){
        closeConfirm();
      }
    }
  );

  savedCloseButton?.addEventListener(
    "click",
    () => {
      closeConfirm();
      setConfirmState();
    }
  );

  let allowNextSave =
    false;

  saveButton.addEventListener(
    "click",
    event => {
      if(allowNextSave){
        allowNextSave =
          false;

        return;
      }

      const changes =
        getChanges();

      if(!changes.length){
        event.preventDefault();
        event.stopImmediatePropagation();
        syncSaveState();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      setConfirmState();

      renderChanges(
        changes
      );

      if(!isConfirmOpen()){
        openConfirmOverlay();
      }
    },
    true
  );

  submitButton.addEventListener(
    "click",
    () => {
      const changes =
        getChanges();

      if(!changes.length){
        syncSaveState();
        return;
      }

      allowNextSave =
        true;

      saveButton.click();

      setTimeout(
        () => {
          captureInitialState();
          setSavedState();
        },
        0
      );
    }
  );

  /* profile-save-dialog-mobile-height:start */
  const syncSaveDialogViewport =
    () => {
      if(!isConfirmOpen()){
        return;
      }

      const dialogHead =
        dialog.querySelector(
          ".profile-save-confirm-head"
        );

      const dialogBody =
        dialog.querySelector(
          ".profile-save-confirm-body"
        );

      const dialogActions =
        dialog.querySelector(
          ".profile-save-confirm-actions"
        );

      if(!dialogBody){
        return;
      }

      /*
        Clear the previous cap first. This lets small confirmation sets
        keep their natural content-driven height.
      */
      dialogBody.style.maxHeight =
        "none";

      const viewportHeight =
        window.visualViewport
          ?.height
        || window.innerHeight;

      const headHeight =
        dialogHead
          ?.getBoundingClientRect()
          .height
        || 0;

      const actionsHeight =
        dialogActions
          ?.getBoundingClientRect()
          .height
        || 0;

      /* 12px top + 12px bottom breathing room around the dialog. */
      const outerGap =
        24;

      const availableBodyHeight =
        Math.max(
          120,
          Math.floor(
            viewportHeight
            - headHeight
            - actionsHeight
            - outerGap
          )
        );

      dialogBody.style.maxHeight =
        `${availableBodyHeight}px`;
    };

  const saveDialogSizeObserver =
    new MutationObserver(
      mutations => {
        if(
          mutations.some(
            mutation =>
              mutation.type
                === "attributes"
          )
        ){
          requestAnimationFrame(
            syncSaveDialogViewport
          );
        }
      }
    );

  saveDialogSizeObserver.observe(
    dialog,
    {
      attributes:true,
      attributeFilter:[
        "open",
        "class"
      ]
    }
  );

  window.addEventListener(
    "resize",
    syncSaveDialogViewport
  );

  window.visualViewport
    ?.addEventListener(
      "resize",
      syncSaveDialogViewport
    );
  /* profile-save-dialog-mobile-height:end */

})();
