(() => {
  "use strict";

  const saveButton =
    document.querySelector(
      "[data-artwall-settings-save]"
    );

  const dialog =
    document.querySelector(
      "[data-artwall-save-confirm-dialog]"
    );

  const title =
    dialog?.querySelector(
      "[data-artwall-save-confirm-title]"
    );

  const lead =
    dialog?.querySelector(
      "[data-artwall-save-confirm-lead]"
    );

  const list =
    dialog?.querySelector(
      "[data-artwall-save-confirm-list]"
    );

  const submitButton =
    dialog?.querySelector(
      "[data-artwall-save-confirm-submit]"
    );

  const cancelButtons =
    dialog?.querySelectorAll(
      "[data-artwall-save-confirm-cancel]"
    )
    || [];

  const savedCloseButton =
    dialog?.querySelector(
      "[data-artwall-save-confirm-saved-close]"
    );

  const savedMyArtLink =
    dialog?.querySelector(
      "[data-artwall-save-confirm-saved-myart]"
    );

  if(
    !saveButton
    || !dialog
    || !list
    || !submitButton
  ){
    return;
  }

  saveButton.classList.add(
    "artwall-settings-save-floating"
  );

  /*
    ----------------------------------------------------------
    Floating Save position
    ----------------------------------------------------------
  */
  const findBottomNavigation =
    () => {
      const selectors = [
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
        of selectors
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
          "--artwall-save-footer-offset",
          `${offset}px`
        );
    };

  syncFooterOffset();

  window.addEventListener(
    "resize",
    syncFooterOffset
  );

  /*
    ----------------------------------------------------------
    Draft state adapters

    Each value below reads the current EDITING state, not the
    last persisted state.
    ----------------------------------------------------------
  */
  const cloneArray =
    value =>
      Array.isArray(value)
        ? value.map(String)
        : [];

  const editorState =
    () => (
      window.MuuzeeArtWallEditor
        ?.getState?.()
      || {}
    );

  const persistedState =
    () => (
      window.MuuzeeArtWallStore
        ?.getRaw?.()
      || window.MuuzeeArtWallStore
        ?.get?.()
      || {}
    );

  const currentColumns =
    () => {
      const api =
        window.MuuzeeArtWallColumns
          ?.get?.();

      if(
        Number(api) === 3
        || Number(api) === 4
      ){
        return Number(api);
      }

      const draft =
        editorState()
          .columns;

      if(
        Number(draft) === 3
        || Number(draft) === 4
      ){
        return Number(draft);
      }

      const persisted =
        persistedState()
          .columns;

      return Number(persisted) === 3
        ? 3
        : 4;
    };

  const currentWallHeightMode =
    () => {
      const draft =
        editorState()
          .wallHeightMode;

      if(
        draft === "expanded"
        || draft === "standard"
      ){
        return draft;
      }

      const wall =
        document.querySelector(
          ".artwall-editor-canvas .wall"
        )
        || document.querySelector(
          ".artwall .wall"
        );

      const domMode =
        wall?.dataset
          .wallHeightMode;

      if(
        domMode === "expanded"
        || domMode === "standard"
      ){
        return domMode;
      }

      return (
        persistedState()
          .wallHeightMode
        === "expanded"
      )
        ? "expanded"
        : "standard";
    };

  const previewGrid =
    () => (
      document.querySelector(
        "[data-artwall-editor-preview] "
        + ".wall-grid.muuzee-masonry-grid"
      )
      || document.querySelector(
        ".artwall-editor-canvas "
        + ".wall-grid.muuzee-masonry-grid"
      )
    );

  const currentGridOrderFromDom =
    () =>
      Array.from(
        previewGrid()
          ?.children
        || []
      )
        .map(
          child =>
            child.dataset
              ?.exhibitionId
        )
        .filter(Boolean)
        .map(String);

  const currentExhibitionOrder =
    () => {
      /*
        Current reorder module explicitly exposes its working order.
        This is the source of truth BEFORE Save persists it.
      */
      const working =
        window.MuuzeeArtWallGridStore
          ?.order;

      if(
        Array.isArray(working)
        && working.length
      ){
        return cloneArray(
          working
        );
      }

      const dom =
        currentGridOrderFromDom();

      if(dom.length){
        return dom;
      }

      return cloneArray(
        persistedState()
          .exhibitionOrder
      );
    };

  const currentDraft =
    () => {
      const editor =
        editorState();

      return {
        showIcon:
          editor.showIcon
          !== false,

        title:
          String(
            editor.title
            ?? ""
          ),

        comment:
          String(
            editor.comment
            ?? ""
          ),

        background:
          String(
            editor.background
            ?? persistedState()
              .background
            ?? "default"
          ),

        columns:
          currentColumns(),

        wallHeightMode:
          currentWallHeightMode(),

        exhibitionOrder:
          currentExhibitionOrder(),

        /*
          Keep legacy/editor membership state in the snapshot too.
          If an older item-visibility UI is still reachable, it is not lost.
        */
        hiddenPrototypeItems:
          cloneArray(
            editor
              .hiddenPrototypeItems
          )
      };
    };

  /*
    ----------------------------------------------------------
    Confirmation fields / labels
    ----------------------------------------------------------
  */
  const backgroundLabels = {
    default:"デフォルト",
    blue:"青",
    pink:"ピンク",
    green:"グリーン",
    yellow:"黄色",
    beige:"ベージュ"
  };

  const heightLabels = {
    standard:"標準",
    expanded:"拡大"
  };

  const sameArray =
    (
      a,
      b
    ) =>
      JSON.stringify(
        cloneArray(a)
      )
      === JSON.stringify(
        cloneArray(b)
      );

  const fields = [
    {
      key:"showIcon",
      label:"アイコン表示",
      format:
        value =>
          value
            ? "表示"
            : "非表示"
    },
    {
      key:"title",
      label:"タイトル",
      format:
        value =>
          String(value || "")
            || "未設定"
    },
    {
      key:"comment",
      label:"コメント",
      format:
        value =>
          String(value || "")
            || "未設定"
    },
    {
      key:"background",
      label:"背景",
      format:
        value =>
          backgroundLabels[value]
          || String(value)
    },
    {
      key:"columns",
      label:"展示会の列数",
      format:
        value =>
          `${value}列`
    },
    {
      key:"wallHeightMode",
      label:"行数",
      format:
        value =>
          heightLabels[value]
          || String(value)
    },
    {
      key:"exhibitionOrder",
      label:"展示会の並び順",
      equals:sameArray,
      beforeText:"並び順",
      afterText:"変更",
      format:
        value =>
          `${cloneArray(value).length}件`
    },
    {
      key:"hiddenPrototypeItems",
      label:"展示会の表示",
      equals:sameArray,
      format:
        value =>
          `${cloneArray(value).length}件を非表示`
    }
  ];

  let baseline =
    null;

  const equals =
    (
      field,
      before,
      after
    ) => (
      field.equals
        ? field.equals(
            before,
            after
          )
        : before === after
    );

  const getChanges =
    () => {
      if(!baseline){
        return [];
      }

      const current =
        currentDraft();

      return fields
        .filter(
          field =>
            !equals(
              field,
              baseline[
                field.key
              ],
              current[
                field.key
              ]
            )
        )
        .map(
          (
            field,
            order
          ) => ({
            key:
              field.key,
            label:
              field.label,
            before:
              field.beforeText
              ?? field.format(
                baseline[
                  field.key
                ]
              ),
            after:
              field.afterText
              ?? field.format(
                current[
                  field.key
                ]
              ),
            order
          })
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

      saveButton.dataset
        .hasChanges =
          hasChanges
            ? "true"
            : "false";
    };

  const captureBaseline =
    () => {
      baseline =
        currentDraft();

      syncSaveState();
    };

  /*
    Other ArtWall modules finish some initial draft setup in RAF.
    Capture only after those initializers settle.
  */
  requestAnimationFrame(
    () => {
      requestAnimationFrame(
        () => {
          setTimeout(
            captureBaseline,
            0
          );
        }
      );
    }
  );

  /*
    ----------------------------------------------------------
    Dirty-state events

    No general DOM MutationObserver is needed.
    Reorder already exposes one explicit grid-change event.
    ----------------------------------------------------------
  */
  const deferredSync =
    () => {
      setTimeout(
        syncSaveState,
        0
      );
    };

  document.addEventListener(
    "input",
    deferredSync
  );

  document.addEventListener(
    "change",
    deferredSync
  );

  document.addEventListener(
    "click",
    event => {
      if(
        event.target
          ?.closest?.(
            [
              "[data-artwall-dialog-apply]",
              "[data-artwall-dialog-cancel]",
              "[data-artwall-dialog-close]",
              "[data-columns-apply]",
              "[data-columns-cancel]",
              "[data-reorder-apply]",
              "[data-reorder-cancel]",
              "[data-reorder-close]",
              ".artwall-reorder-dialog-close"
            ].join(",")
          )
      ){
        deferredSync();
      }
    }
  );

  document.addEventListener(
    "muuzee:artwall-grid-changed",
    deferredSync
  );

  window.addEventListener(
    "muuzee:artwall-store-change",
    deferredSync
  );

  window.addEventListener(
    "muuzee:artwall-draft-change",
    deferredSync
  );

  /*
    ----------------------------------------------------------
    Confirmation dialog
    ----------------------------------------------------------
  */
  const renderChanges =
    changes => {
      list.replaceChildren();

      const fragment =
        document.createDocumentFragment();

      changes.forEach(
        change => {
          const item =
            document.createElement(
              "div"
            );

          item.className =
            "artwall-save-confirm-item";

          const itemLabel =
            document.createElement(
              "p"
            );

          itemLabel.className =
            "artwall-save-confirm-label";

          itemLabel.textContent =
            change.label;

          const values =
            document.createElement(
              "div"
            );

          values.className =
            "artwall-save-confirm-values";

          const before =
            document.createElement(
              "div"
            );

          before.className =
            "artwall-save-confirm-before";

          before.textContent =
            change.before;

          const arrow =
            document.createElement(
              "span"
            );

          arrow.className =
            "artwall-save-confirm-arrow";

          arrow.textContent =
            "→";

          const after =
            document.createElement(
              "div"
            );

          after.className =
            "artwall-save-confirm-after";

          after.textContent =
            change.after;

          values.append(
            before,
            arrow,
            after
          );

          item.append(
            itemLabel,
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
          "ArtWallの設定を保存しました。";
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

  const closeDialog =
    () => {
      if(dialog.open){
        dialog.close();
      }
    };

  cancelButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeDialog
      );
    }
  );

  savedCloseButton
    ?.addEventListener(
      "click",
      () => {
        closeDialog();
        setConfirmState();
      }
    );

  dialog.addEventListener(
    "click",
    event => {
      if(
        event.target
        === dialog
      ){
        closeDialog();
      }
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

      if(!dialog.open){
        dialog.showModal();
      }
    },
    true
  );

  submitButton.addEventListener(
    "click",
    () => {
      if(
        !getChanges()
          .length
      ){
        syncSaveState();

        return;
      }

      allowNextSave =
        true;

      saveButton.disabled =
        false;

      /*
        Reuse every existing ArtWall module's Save listener.
        Several modules persist their own current working state on this click.
      */
      saveButton.click();

      /*
        Existing module Save patches are queued with setTimeout(0).
        Queue our baseline refresh afterwards.
      */
      setTimeout(
        () => {
          captureBaseline();
          setSavedState();
        },
        20
      );
    }
  );
})();
