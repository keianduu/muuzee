/*
  Muuzee ArtWall Edit — profile popup structure adapter

  Follow the current Seen-popup composition first:
  head -> page-specific section -> body -> actions.

  Profile content is moved out of .artwall-editor-dialog-body so section
  dividers can span the full popup width.
*/
(() => {
  "use strict";

  const DIALOG =
    ".artwall-editor-dialog";

  const PROFILE =
    ".artwall-editor-dialog-profile";

  const BODY =
    ".artwall-editor-dialog-body";

  const enhance =
    dialog => {
      if (
        !dialog
        || dialog.dataset
          .profileStructureEnhanced
      ) {
        return;
      }

      const body =
        dialog.querySelector(
          BODY
        );

      const profile =
        body?.querySelector(
          `:scope > ${PROFILE}`
        );

      if (
        !body
        || !profile
      ) {
        return;
      }

      dialog.dataset
        .profileStructureEnhanced =
          "true";

      /*
        Same structural idea as the current "「観た」展示会" popup:
        section is a direct dialog child immediately before body.
      */
      body.before(
        profile
      );

      /*
        Profile popup intentionally has no content inside dialogBody.
        Keep the node itself because generic dialog JS owns it.
      */
      body.replaceChildren();
      body.hidden =
        true;

      body.dataset
        .profileEmptyBody =
          "true";
    };

  const observer =
    new MutationObserver(
      mutations => {
        for (
          const mutation
          of mutations
        ) {
          for (
            const node
            of mutation.addedNodes
          ) {
            if (
              !(node instanceof Element)
            ) {
              continue;
            }

            if (
              node.matches?.(
                DIALOG
              )
            ) {
              enhance(
                node
              );
            }

            node
              .querySelectorAll?.(
                DIALOG
              )
              .forEach(
                enhance
              );
          }
        }
      }
    );

  observer.observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );

  document
    .querySelectorAll(
      DIALOG
    )
    .forEach(
      enhance
    );

  document.documentElement
    .dataset
    .artwallProfileStructure =
      "v20260908-01";
})();
