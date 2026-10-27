/**
 * Header collision fixes for CSS viewports below 320px (covers 375px at 200% zoom
 * ≈ 188px). 320 / 375 / 414 phone layouts and desktop are unchanged.
 */
export const WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX = 319;

export const WP_SHELL_NARROW_HEADER_CSS = `
      @media screen and (max-width: ${WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX}px) {
        header#header > .container {
          height: auto;
          min-height: 52px;
          padding-top: 8px;
          padding-bottom: 8px;
        }
        header#header > .container > .row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          min-width: 0;
          max-width: 100%;
          padding-inline-end: 3rem;
          box-sizing: border-box;
        }
        header#header .logo {
          min-width: 0;
          max-width: calc(100% - 8px);
          height: auto;
        }
        header#header .logo a {
          font-size: 22px;
          max-width: 100%;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        header#header .logo img {
          max-width: 100%;
          max-height: 28px;
          height: auto;
        }
        /* Drop the in-bar Apply Now sibling (a.header-apply-now) so it cannot overlap the logo.
           Apply Visa remains in the hamburger drawer. Also hide a leftover li.button CTA. */
        header#header a.header-whatsapp,
        header#header a.header-apply-now,
        header#header nav.menu ul li.button {
          display: none !important;
        }
        body.show-menu header#header nav.menu ul li.button {
          display: block !important;
        }
        header#header nav.menu ul li.button a {
          min-width: 0;
          max-width: 100%;
        }
        header#header .featured_on .inner {
          flex-wrap: wrap;
          white-space: normal;
          overflow: visible;
          row-gap: 4px;
          min-width: 0;
          max-width: 100%;
        }
        header#header .featured_on .inner a {
          flex-shrink: 0;
        }
        header#header .featured_on .inner a img {
          height: 14px;
          max-width: 80px;
        }
      }
`;
