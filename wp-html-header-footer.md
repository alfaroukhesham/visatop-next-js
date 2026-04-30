# TopVisa V3 — Header + Footer HTML structure (extracted)

This file contains the **header and footer markup structure** as used by the `topvisa-v3` theme.

- Source: `wp-content/themes/topvisa-v3/header.php`
- Source: `wp-content/themes/topvisa-v3/footer.php`

## Header structure (`header.php`)

```php
	<header id="header">
		<div class="container">
			<div class="row">
				<div class="col logo">
					<a href="<?php echo esc_url( function_exists( 'pll_home_url' ) ? pll_home_url() : home_url( '/' ) ); ?>">
					<?php
                    $custom_logo_id = get_theme_mod('custom_logo');
                    $logo = wp_get_attachment_image_src($custom_logo_id, 'full');
                    if (has_custom_logo()) {
                        echo '<img src="' . esc_url($logo[0]) . '" alt="' . htmlspecialchars(get_bloginfo('name') ) . '">';
                    } else {
                        echo get_bloginfo('name');
                    }
					?>
					</a>
				</div>

				<nav class="col menu">
					<?php
					wp_nav_menu([
						'theme_location' => 'header_menu',
						'menu' => '',
						'container' => 'ul',
						'container_class' => '',
						'menu_class' => 'menu__list menu',
						'walker' => new CustomizeNavSubmenu()
					]);
					?>
				</nav>

				<button class="mobile_menu"></button>
			</div>
		</div>

		<div class="featured_on">
			<div class="container">
				<div class="row">
					<div class="col-12 inner">
						<?php if ( ! empty( $featured = get_field( 'featured_on', 'option' ) ) ) { ?>
							<?php vt_e( 'Featured on:' ); ?>
							<?php foreach ( $featured as $item ) { ?>
								<a href="<?php echo esc_url( $item['link'] ); ?>">
									<?php if ( ! empty( $item['logo'] ) ) { ?>
										<img src="<?php echo esc_url( $item['logo']['url'] ); ?>" alt="<?php echo esc_attr( $item['name'] ); ?>" style="height: 1em; width: auto; filter: brightness(0) invert(1); vertical-align: middle;">
									<?php } ?>
								</a>
							<?php } ?>
						<?php } ?>
						<div class="uae-time" style="margin-left: auto;">
							<span class="uae-time-label"><?php vt_e( 'Time in UAE:' ); ?> </span><?php 
								$uae_time = new DateTime( "now", new DateTimeZone( "Asia/Dubai" ) );
								echo $uae_time->format( "D, j M y H:i" ); 
							?>
						</div>
					</div>
				</div>
			</div>
		</div>
	</header>
```

## Footer structure (`footer.php`)

```php
</div>

<footer id="footer">
	<div class="container">
		<div class="row">
			<div class="col-md-6 col-lg-4 left_block">
				<div class="logo">
					<a href="<?php echo esc_url( function_exists( 'pll_home_url' ) ? pll_home_url() : home_url( '/' ) ); ?>">
                        <?php
                        $custom_logo_id = get_theme_mod('custom_logo');
                        $logo = wp_get_attachment_image_src($custom_logo_id, 'full');
                        if (has_custom_logo()) {
                            echo '<img src="' . esc_url($logo[0]) . '" alt="' . htmlspecialchars(get_bloginfo('name') ) . '">';
                        } else {
                            echo get_bloginfo('name');
                        }
                        ?>
					</a>
				</div>
				<div class="info">
					<?= get_field('footer_description', 'option') ?>
				</div>
				<div class="copyright">
				<?php printf( vt__( 'Copyright @%s VisaTop.com - All rights reserved' ), date( 'Y' ) ); ?>
				</div>
				<div class="footer-social-lang">
					<div class="social">
						<a class="linkedin" href="https://www.linkedin.com/company/visatop" target="_blank" rel="noopener noreferrer">
							<?php include( THEME_DIR . '/assets/images/social/in.svg' ); ?>
						</a>
						<a class="youtube" href="https://www.youtube.com/@VisaTopChannel" target="_blank" rel="noopener noreferrer">
							<?php include( THEME_DIR . '/assets/images/social/yt.svg' ); ?>
						</a>
						<a class="instagram" href="https://www.instagram.com/visatop_channel/" target="_blank" rel="noopener noreferrer">
							<?php include( THEME_DIR . '/assets/images/social/ig.svg' ); ?>
						</a>
						<a class="tiktok" href="https://www.tiktok.com/@visatop" target="_blank" rel="noopener noreferrer">
							<?php include( THEME_DIR . '/assets/images/social/tt.svg' ); ?>
						</a>
					</div>
					<?php topvisa_footer_language_switcher(); ?>
				</div>
			</div>

			<div class="col-md-6 col-lg-8 right_block">
				<div class="row">
					<div class="col-xl-6 contacts">
						<div class="item">
							<a href="mailto:<?= get_field('email', 'option') ?>">
								<img src="<?= THEME_URL ?>/assets/images/icon-email.svg">
								<?= get_field('email', 'option') ?>
							</a>
						</div>
						<div class="item">
							<a href="https://wa.me/<?= TopVisa::trimPhoneNumber( get_field('phone', 'option') ); ?>" target="_blank" rel="noopener noreferrer">
								<img src="<?= THEME_URL ?>/assets/images/icon-phone.svg">
								<span dir="ltr" style="unicode-bidi:isolate;">
									<?= get_field('phone', 'option') ?>
								</span>
							</a>
						</div>
					</div>
					<div class="col-xl-6 menu">
						<?php
						wp_nav_menu([
							'theme_location' => 'footer_menu',
							'menu' => '',
							'container' => 'ul',
							'container_class' => '',
							'menu_class' => 'menu__list menu',
						]);
						?>
					</div>
				</div>
			</div>
		</div>
		
		<div class="row">
			<div class="col-md-8 disclaimer">
				<?php echo esc_html( vt__( VT_FOOTER_DISCLAIMER ) ); ?>
			</div>
		</div>

	</div>
</footer>
```

