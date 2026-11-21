<?php
/**
 * Test helper (wp eval-file): saves a style on the site as the Site Editor does when a style is chosen.
 * Argument: a style's title, or "plain" for six colors without twins, as a style from elsewhere may be.
 */
$want = $args[0] ?? '';
$data = array(
	'version'                     => 3,
	'isGlobalStylesUserThemeJSON' => true,
);
if ( 'plain' === $want ) {
	$palette = array();
	foreach ( array( 'base' => '#fff1e6', 'contrast' => '#40210f', 'accent-1' => '#c2410c', 'accent-3' => '#2a1206', 'accent-5' => '#40210f0d', 'accent-6' => '#40210f33' ) as $slug => $color ) {
		$palette[] = array(
			'slug'  => $slug,
			'name'  => $slug,
			'color' => $color,
		);
	}
	$data['settings'] = array( 'color' => array( 'palette' => array( 'theme' => $palette ) ) );
}
foreach ( WP_Theme_JSON_Resolver::get_style_variations() as $variation ) {
	if ( $variation['title'] === $want ) {
		$data['settings'] = $variation['settings'] ?? array();
		$data['styles']   = $variation['styles'] ?? array();
	}
}
wp_update_post(
	array(
		'ID'           => WP_Theme_JSON_Resolver::get_user_global_styles_post_id(),
		'post_content' => wp_slash( wp_json_encode( $data ) ),
	)
);
wp_clean_theme_json_cache();
echo isset( $data['settings'] ) ? 'applied' : 'none';
