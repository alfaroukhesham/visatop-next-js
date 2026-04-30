# TopVisa V3 — Header + Footer CSS (extracted)

This file collects the CSS **required for the theme header and footer** from the `topvisa-v3` theme stylesheets.

- Source (LTR): `wp-content/themes/topvisa-v3/assets/scss/styles.css`
- Source (RTL overrides): `wp-content/themes/topvisa-v3/assets/scss/styles-rtl.css`

## Header CSS (LTR)

```css
body.admin-bar header#header {
  top: 32px;
}
@media screen and (max-width: 782px) {
  body.admin-bar header#header {
    top: 46px;
  }
}
@media screen and (max-width: 767px) {
  body.admin-bar header#header nav.menu {
    top: 46px;
    height: calc(100vh - 46px);
  }
}

body.show-menu {
  overflow: hidden;
}
body.show-menu header#header:before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  display: block;
  width: 100%;
  height: 100%;
  background-color: #012031;
  opacity: 0.75;
}
body.show-menu header#header .mobile_menu {
  border-top-color: transparent;
}
body.show-menu header#header .mobile_menu:before {
  top: 12px;
  transform: rotate(45deg);
}
body.show-menu header#header .mobile_menu:after {
  bottom: 11px;
  transform: rotate(-45deg);
}
body.show-menu header#header nav.menu {
  right: 0;
}

header#header {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  width: 100%;
  background-color: rgba(34, 77, 100, 0);
  z-index: 100;
}
header#header > .container {
  display: relative;
  padding-top: 16px;
  padding-bottom: 16px;
  height: 86px;
}
header#header .logo {
  height: 42px;
  max-width: 200px;
  line-height: 1;
}
header#header .logo a {
  font-size: 36px;
  font-family: "Inter", sans-serif;
  text-decoration: none;
  color: #FFFFFF;
}
header#header .logo img {
  max-width: 100%;
  max-height: 100%;
}
header#header nav.menu {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
@media screen and (max-width: 767px) {
  header#header nav.menu {
    position: fixed;
    top: 0;
    right: -280px;
    left: unset;
    width: 280px;
    height: 100vh;
    background: #012031;
    padding: 80px 35px 40px;
    align-items: flex-start;
    z-index: 101;
    transition: all 0.2s linear;
    overflow-x: hidden;
  }
}
header#header nav.menu ul {
  display: inline-flex;
  align-items: center;
  gap: 50px;
  list-style: none;
  padding: 0;
  margin: 0;
}
@media screen and (max-width: 991px) {
  header#header nav.menu ul {
    gap: 35px;
  }
}
@media screen and (max-width: 767px) {
  header#header nav.menu ul {
    gap: 25px;
    flex-wrap: wrap;
  }
}
header#header nav.menu ul li {
  position: relative;
}
@media screen and (max-width: 767px) {
  header#header nav.menu ul li {
    width: 100%;
  }
}
header#header nav.menu ul li.menu-item-has-children.open .sub-menu {
  opacity: 1;
  visibility: visible;
}
@media screen and (max-width: 767px) {
  header#header nav.menu ul li.menu-item-has-children.open .sub-menu {
    display: block;
  }
}
header#header nav.menu ul li.menu-item-has-children > a {
  padding-right: 20px;
}
header#header nav.menu ul li.menu-item-has-children > a:before {
  content: "";
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 12px;
  height: 100%;
  background-image: url(../images/arrow-down.svg);
  background-repeat: no-repeat;
  background-position: center center;
  background-size: contain;
}
@media all and (min-width: 992px) {
  header#header nav.menu ul li.button {
    padding-inline-start: 68px;
  }
}
@media print {
  header#header nav.menu ul li.button {
    padding-inline-start: 68px;
  }
}
header#header nav.menu ul li.button a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 148px;
  height: 46px;
  border-radius: 5px;
  border: none;
  padding: 0 15px;
  background-color: #FCCD64;
  color: #012031;
  font-family: "Inter", sans-serif;
  font-size: 16px;
  font-weight: 400;
  text-transform: uppercase;
  text-decoration: none;
  outline: none;
  cursor: pointer;
  transition: all 0.2s linear;
}
header#header nav.menu ul li.button a:hover {
  background-color: #FFE19F;
}
header#header nav.menu ul li.button a:after {
  display: none;
}
header#header nav.menu .current-menu-item a {
  color: #FCCD64;
}
header#header nav.menu .current-menu-item a:after {
  opacity: 1;
  visibility: visible;
}
header#header nav.menu .current-menu-parent > a:after {
  opacity: 1;
  visibility: visible;
}
header#header nav.menu a {
  position: relative;
  color: #FFFFFF;
  font-family: "Inter", sans-serif;
  font-weight: 400;
  line-height: 1;
  text-decoration: none;
  display: inline-block;
  padding: 5px 0;
  transition: all 0.2s linear;
}
header#header nav.menu a:hover {
  color: #FCCD64;
}
header#header nav.menu a:after {
  content: "";
  position: absolute;
  width: 100%;
  height: 3px;
  background-color: #FCCD64;
  left: 0;
  top: 100%;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s linear;
}
header#header nav.menu .sub-menu {
  position: absolute;
  top: calc(100% + 28px);
  left: 27px;
  width: 555px;
  display: block;
  padding: 43px 54px;
  background: #F2F9FC;
  border-radius: 10px;
  box-shadow: 5px 5px 4px rgba(0, 0, 0, 0.25);
  columns: 2;
  column-gap: 26px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%);
  transition: all 0.2s linear;
}
@media screen and (max-width: 767px) {
  header#header nav.menu .sub-menu {
    position: relative;
    top: 15px;
    left: -20px;
    width: calc(100% + 40px);
    padding: 20px;
    transform: unset;
    columns: 1;
    display: none;
  }
}
header#header nav.menu .sub-menu:before {
  content: "";
  display: block;
  width: 15px;
  height: 15px;
  background: #F2F9FC;
  position: absolute;
  top: -7.5px;
  left: calc(50% - 7.5px);
  transform: rotate(45deg);
}
@media screen and (max-width: 767px) {
  header#header nav.menu .sub-menu:before {
    display: none;
  }
}
header#header nav.menu .sub-menu li {
  margin-bottom: 17px;
}
header#header nav.menu .sub-menu li.current_page_item a:after {
  display: none;
}
header#header nav.menu .sub-menu li.current_page_item a .title {
  color: #FCCD64;
}
header#header nav.menu .sub-menu a {
  font-family: "Inter", sans-serif;
  padding: 0;
}
header#header nav.menu .sub-menu a:hover .title {
  color: #FCCD64;
}
header#header nav.menu .sub-menu a .title {
  font-size: 17px;
  font-weight: 500;
  line-height: 1.2;
  margin-bottom: 4px;
  color: #224D64;
  transition: all 0.2s linear;
}
header#header nav.menu .sub-menu a .subtitle {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #7095A7;
}
header#header .mobile_menu {
  display: none;
  position: absolute;
  top: 50%;
  right: 0.75rem;
  width: 40px;
  height: 26px;
  border: none;
  background-color: transparent;
  border-top: 1px solid #FFFFFF;
  transform: translateY(-50%);
  transition: all 0.2s linear;
  z-index: 102;
}
@media screen and (max-width: 767px) {
  header#header .mobile_menu {
    display: block;
  }
}
header#header .mobile_menu:before, header#header .mobile_menu:after {
  content: "";
  position: absolute;
  top: calc(50% - 1px);
  left: 0;
  display: block;
  width: 40px;
  height: 1px;
  background-color: #FFFFFF;
  transition: all 0.2s linear;
}
header#header .mobile_menu:after {
  top: unset;
  bottom: 0;
}

/* Featured-on bar (inside header) */
header#header .featured_on {
  position: relative;
  order: -1;
  background: #1a2b45;
  width: 100%;
  padding: 10px 0;
  color: #FFFFFF;
  font-family: "Inter", sans-serif;
  font-size: 15px;
  font-weight: 400;
  z-index: 101;
}
header#header .featured_on .inner {
  display: flex;
  align-items: center;
  gap: 0;
}
header#header .featured_on .inner a {
  position: relative;
  display: inline-block;
  padding-right: 8px;
  padding-left: 8px;
  line-height: 1;
  color: #FFFFFF;
  text-decoration: none;
}
header#header .featured_on .inner a:not(:last-of-type):after {
  content: "|";
  position: absolute;
  right: 0;
  top: 0;
  color: #FFFFFF;
}
header#header .featured_on .inner a:hover {
  opacity: 0.8;
}
@media screen and (max-width: 767px) {
  header#header .featured_on {
    font-size: 12px;
    padding: 6px 0;
  }
  header#header .featured_on .inner {
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow: hidden;
  }
  header#header .featured_on .inner a {
    padding-right: 5px;
    padding-left: 5px;
  }
  header#header .featured_on .inner .uae-time .uae-time-label {
    display: none;
  }
}

/* Page-level header background overrides */
body.error404 header#header {
  background-color: rgb(34, 77, 100) !important;
}
body.page:not(.page-template-page-prices) header#header {
  background-color: rgb(34, 77, 100) !important;
}
body.single-news header#header,
body.page-template-default header#header {
  background: rgb(34, 77, 100) !important;
}
body.single header#header {
  background: rgb(34, 77, 100) !important;
}
body.page-template-page-ai header#header {
  background: rgb(34, 77, 100) !important;
}

/* Header language switcher */
header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px; /* no arrow, symmetric padding */
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 20px;
  white-space: nowrap;
  transition: border-color 0.2s linear, color 0.2s linear;
}
header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger:hover {
  border-color: #FCCD64;
  color: #FCCD64;
}
header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger:before {
  display: none;
}
header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger:after {
  display: none;
}
header#header nav.menu .lang-globe {
  flex-shrink: 0;
  vertical-align: middle;
}
header#header nav.menu .lang-switcher-label {
  font-size: 14px;
  font-family: "Inter", sans-serif;
  font-weight: 400;
  line-height: 1;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu {
  width: 160px;
  min-width: 160px;
  columns: 1;
  column-gap: 0;
  padding: 16px 20px;
  left: 50%;
  transform: translateX(-50%);
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu li {
  margin-bottom: 10px;
  break-inside: avoid;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu li:last-child {
  margin-bottom: 0;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu a {
  font-size: 14px;
  font-weight: 400;
  color: #224D64;
  padding: 0;
  display: block;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu a:hover {
  color: #CE8E00;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu a:after {
  display: none;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu .current-lang a {
  color: #CE8E00;
  font-weight: 600;
}
@media screen and (max-width: 767px) {
  header#header nav.menu ul li.lang-switcher-item .lang-sub-menu {
    width: calc(100% + 40px);
    transform: unset;
    left: -20px;
  }
  header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger {
    border-color: rgba(255, 255, 255, 0.25);
  }
}
@media screen and (max-width: 767px) {
  html[dir="rtl"] header#header nav.menu ul li.lang-switcher-item .lang-sub-menu {
    left: auto;
    right: -20px;
  }
}
header#header nav.menu ul li.lang-item {
  display: none;
}
header#header nav.menu ul li.lang-switcher-item .lang-sub-menu li.lang-item {
  display: list-item;
}
```

## Footer CSS (LTR)

```css
footer#footer {
  background-color: #012031;
  padding: 68px 0 40px;
  color: #FFFFFF;
}
@media screen and (max-width: 767px) {
  footer#footer {
    text-align: center;
  }
}
footer#footer .container .row {
  align-items: center;
}
@media screen and (max-width: 767px) {
  footer#footer .left_block {
    order: 2;
  }
}
@media screen and (max-width: 767px) {
  footer#footer .right_block {
    order: 1;
  }
}
footer#footer .logo {
  margin-bottom: 16px;
}
@media screen and (max-width: 767px) {
  footer#footer .logo {
    order: 1;
  }
}
footer#footer .logo img {
  height: 42px;
}
footer#footer .disclaimer,
footer#footer .info,
footer#footer .copyright {
  font-size: 13px;
  font-family: "Inter", sans-serif;
  font-weight: 300;
  line-height: 1.4;
  max-width: 364px;
}
@media screen and (max-width: 767px) {
  footer#footer .disclaimer,
  footer#footer .info,
  footer#footer .copyright {
    margin: 0 auto;
  }
}
footer#footer .disclaimer p,
footer#footer .info p,
footer#footer .copyright p {
  margin-bottom: 10px;
}
footer#footer .disclaimer p:last-child,
footer#footer .info p:last-child,
footer#footer .copyright p:last-child {
  margin-bottom: 0;
}
footer#footer .copyright {
  margin-top: 10px;
}
footer#footer .disclaimer {
  margin: 40px auto 0;
  max-width: 100%;
  text-align: center;
  color: #7095A7;
}
footer#footer .contacts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 76px;
}
@media screen and (max-width: 1199px) {
  footer#footer .contacts {
    justify-content: flex-end;
    gap: 60px;
    order: 2;
  }
}
@media screen and (max-width: 767px) {
  footer#footer .contacts {
    flex-wrap: wrap;
    gap: 35px;
    justify-content: center;
    margin-bottom: 40px;
    order: 3;
  }
}
footer#footer .contacts a {
  text-decoration: none;
  color: #FFFFFF;
  font-weight: 300;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  transition: all 0.2s linear;
  white-space: nowrap;
}
footer#footer .contacts a:hover {
  color: #FCCD64;
}
footer#footer .contacts a img {
  margin-right: 12px;
}
footer#footer .menu {
  justify-content: flex-end;
}
@media screen and (max-width: 1199px) {
  footer#footer .menu {
    margin-bottom: 20px;
    order: 1;
  }
}
@media screen and (max-width: 767px) {
  footer#footer .menu {
    justify-content: center;
    margin-bottom: 40px;
    order: 2;
  }
}
footer#footer .menu ul {
  display: flex;
  gap: 36px;
  list-style: none;
  padding: 0;
  margin: 0;
}
@media screen and (max-width: 413px) {
  footer#footer .menu ul {
    justify-content: space-between;
    gap: unset;
  }
}
footer#footer .menu ul li {
  padding: 0;
}
footer#footer .menu a {
  color: #7095A7;
  font-weight: 300;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.2s linear;
}
footer#footer .menu a:hover {
  color: #FCCD64;
}
footer#footer .social {
  margin-top: 20px;
}
footer#footer .footer-social-lang {
  margin-top: 20px;
}
footer#footer .footer-social-lang .social {
  margin-top: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
footer#footer .footer-social-lang .social a.linkedin,
footer#footer .footer-social-lang .social a.youtube,
footer#footer .footer-social-lang .social a.instagram,
footer#footer .footer-social-lang .social a.tiktok {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  vertical-align: middle;
}
footer#footer .social .linkedin:hover svg path:first-child,
footer#footer .social .youtube:hover svg path:first-child,
footer#footer .social .instagram:hover svg path:first-child,
footer#footer .social .tiktok:hover svg path:first-child {
  fill: #FFFFFF;
}
footer#footer .social .linkedin svg path:first-child,
footer#footer .social .youtube svg path:first-child,
footer#footer .social .instagram svg path:first-child,
footer#footer .social .tiktok svg path:first-child {
  transition: all 0.2s linear;
}

/* Footer language dropup */
footer#footer .footer-lang-dropdown {
  margin-top: 0;
  flex-shrink: 0;
  line-height: 0;
}
footer#footer .footer-lang-dropdown__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 25px;
  line-height: 0;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}
footer#footer .footer-lang-dropdown__toggle:focus,
footer#footer .footer-lang-dropdown__toggle:focus-visible,
footer#footer .footer-lang-dropdown__toggle:active,
footer#footer .footer-lang-dropdown__toggle.show {
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}
footer#footer .footer-lang-dropdown__current-flag img {
  display: block;
  width: 24px;
  height: 25px;
  object-fit: cover;
}
footer#footer .footer-lang-dropdown__menu {
  min-width: 3.5rem;
  padding: 0.5rem 0.35rem;
  background: #f2f9fc;
  border: none;
  border-radius: 10px;
  z-index: 1080;
}
footer#footer .footer-lang-dropdown__menu .dropdown-item {
  padding: 0.35rem 0.5rem;
  border-radius: 0.25rem;
  color: #224d64;
}
footer#footer .footer-lang-dropdown__menu .dropdown-item:hover,
footer#footer .footer-lang-dropdown__menu .dropdown-item:focus {
  background-color: rgba(34, 77, 100, 0.08);
  color: #ce8e00;
}
footer#footer .footer-lang-dropdown__menu .dropdown-item.active,
footer#footer .footer-lang-dropdown__menu .dropdown-item:active {
  background-color: rgba(206, 142, 0, 0.15);
  color: #ce8e00;
  font-weight: 600;
}
footer#footer .footer-lang-dropdown__item-flag img {
  display: block;
  width: 24px;
  height: 25px;
  object-fit: cover;
}
footer#footer .footer-social-lang {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
}
@media screen and (max-width: 767px) {
  footer#footer .left_block {
    text-align: center;
  }
  footer#footer .footer-social-lang {
    justify-content: center;
  }
}
```

## RTL overrides (Header + Footer)

```css
/* Slide-out mobile nav opens from the left instead of the right */
header#header nav.menu {
  right: unset;
  left: -280px;
}
body.show-menu header#header nav.menu {
  right: unset;
  left: 0;
}

/* Mobile hamburger button stays on the left side */
header#header .mobile_menu {
  right: unset;
  left: 0.75rem;
}

/* Nav underline indicator: flip from left: 0 to right: 0 */
header#header nav.menu a::after {
  left: unset;
  right: 0;
}

/* Dropdown arrow: flip padding from right to left */
header#header nav.menu li.menu-item-has-children > a {
  padding-right: 0;
  padding-left: 20px;
}
header#header nav.menu li.menu-item-has-children > a::before {
  right: unset;
  left: 0;
}

/* Sub-menu: flip horizontal position */
header#header nav.menu .sub-menu {
  left: unset;
  right: 27px;
  transform: translateX(50%);
}
header#header nav.menu .sub-menu::before {
  left: unset;
  right: calc(50% - 7.5px);
}

/* "Button" nav item: flip padding */
header#header nav.menu ul li.button {
  padding-left: 0;
  padding-right: 68px;
}

/* Mobile sub-menu offset */
@media (max-width: 767px) {
  header#header nav.menu .sub-menu {
    right: -20px;
    left: unset;
    transform: unset;
  }
}

/* Featured-on bar: UAE time pushed to the left in RTL */
header#header .featured_on .uae-time {
  margin-left: 0;
  margin-right: auto;
}

/* Contact icons: flip margin from right to left */
footer#footer .contacts a img {
  margin-right: 0;
  margin-left: 12px;
}

/* Menu links: flip justify-content for desktop */
footer#footer .menu {
  justify-content: flex-start;
}
```

