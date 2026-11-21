<?php
/**
 * Windrose Prow for Metis: the adapter between Metis's color names (theme-1 to theme-12) and the common names
 * (base, contrast, accent-1, accent-3, accent-5, accent-6), and a dark mode that follows the site's style.
 *
 * @package Windrose\ProwMetis
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WINDROSE_PROW_METIS_VERSION = '0.1.0';

/**
 * The common color names, in Ipsum's order.
 */
const WINDROSE_PROW_METIS_COLORS = array( 'base', 'contrast', 'accent-1', 'accent-3', 'accent-5', 'accent-6' );

/**
 * What each of Metis's twelve colors follows.
 *
 * 1 page background, 2 strong text, 3 text, 4 faint surface, 5 background at 75 %, 6 raised surface (a style may
 * set it: settings.custom.prow.raised), 7 to 12 soft accents (a style may set them: settings.custom.prow.soft-1 to
 * soft-6; otherwise the accent's hue turned in steps of 60 degrees, mixed into the background).
 *
 * @return array<int, string> Number => CSS value.
 */
function windrose_prow_metis_map(): array {
	$color = static fn( string $slug ): string => "var(--wp--preset--color--$slug)";
	$map   = array(
		1 => $color( 'base' ),
		2 => $color( 'accent-3' ),
		3 => $color( 'contrast' ),
		4 => $color( 'accent-5' ),
		5 => 'rgb(from ' . $color( 'base' ) . ' r g b / 75%)',
		6 => 'var(--wp--custom--prow--raised, ' . windrose_prow_metis_derived( 0 ) . ')',
	);
	for ( $soft = 1; $soft <= 6; $soft++ ) {
		$map[ 6 + $soft ] = "var(--wp--custom--prow--soft-$soft, " . windrose_prow_metis_derived( $soft ) . ')';
	}
	return $map;
}

/**
 * The value calculated from the common colors when a style sets none: the raised surface (0) or a soft accent (1 to 6).
 *
 * @param int $soft 0, or 1 to 6.
 * @return string CSS value.
 */
function windrose_prow_metis_derived( int $soft ): string {
	if ( 0 === $soft ) {
		return 'oklch(from var(--wp--preset--color--base) calc(l + 0.03) c h)';
	}
	$turn = ( $soft - 1 ) * 60;
	return "color-mix(in oklab, var(--wp--preset--color--base) 78%, oklch(from var(--wp--preset--color--accent-1) l c calc(h + $turn)))";
}

/**
 * The site's colors in effect: slug => color (the theme's or the saved style's, then the site's own).
 *
 * @return array<string, string>
 */
function windrose_prow_metis_colors(): array {
	$colors = array();
	foreach ( array( 'theme', 'custom' ) as $origin ) {
		$entries = wp_get_global_settings( array( 'color', 'palette', $origin ) );
		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			if ( is_array( $entry ) && isset( $entry['slug'], $entry['color'] ) ) {
				$colors[ (string) $entry['slug'] ] = (string) $entry['color'];
			}
		}
	}
	return $colors;
}

/**
 * The style's other scheme: "dark" for a light style, "light" for a dark one, "" when it has no twin colors
 * (Windrose Livery's twins: windrose-livery-dark-<slug> or windrose-livery-light-<slug>).
 *
 * @return string
 */
function windrose_prow_metis_other_scheme(): string {
	$colors = windrose_prow_metis_colors();
	foreach ( array( 'dark', 'light' ) as $scheme ) {
		if ( isset( $colors[ "windrose-livery-$scheme-base" ] ) ) {
			return $scheme;
		}
	}
	return '';
}

/**
 * The adapter's CSS, for the site and the editor.
 *
 * @return string
 */
function windrose_prow_metis_css(): string {
	// A saved style in Metis's own names (not one of this theme's): nothing to follow, core writes Metis's names itself.
	if ( ! isset( windrose_prow_metis_colors()['base'] ) ) {
		return '';
	}
	$map = windrose_prow_metis_map();
	$css = ':root{';
	foreach ( $map as $number => $value ) {
		$css .= "--wp--preset--color--theme-$number:$value;";
	}
	$css .= '}';
	foreach ( array_keys( $map ) as $number ) {
		$var  = "var(--wp--preset--color--theme-$number)";
		$css .= ".has-theme-$number-color{color:$var !important}.has-theme-$number-background-color{background-color:$var !important}.has-theme-$number-border-color{border-color:$var !important}";
	}
	// Core merges settings.custom key by key, so a saved style that sets no raised surface and no soft accents would
	// keep the default style's: "initial" makes each var() above use its calculated value.
	if ( windrose_prow_metis_foreign_style() ) {
		$css .= 'html:root{';
		foreach ( array_keys( windrose_prow_metis_own_custom() ) as $key ) {
			$css .= "--wp--custom--prow--$key:initial;";
		}
		$css .= '}';
	}
	// The other scheme: the style's own values for the raised surface and the soft accents, or the calculated ones.
	$scheme = windrose_prow_metis_other_scheme();
	$prefix = '' === $scheme ? 'dark' : $scheme;
	$css   .= 'html[data-metis-mode="dark"]:root{color-scheme:' . ( 'light' === $scheme ? 'light' : 'dark' ) . ';';
	$css   .= "--wp--custom--prow--raised:var(--wp--custom--prow--$prefix-raised, " . windrose_prow_metis_derived( 0 ) . ');';
	for ( $soft = 1; $soft <= 6; $soft++ ) {
		$css .= "--wp--custom--prow--soft-$soft:var(--wp--custom--prow--$prefix-soft-$soft, " . windrose_prow_metis_derived( $soft ) . ');';
	}
	return $css . '}';
}

/**
 * The raised surface and soft accents of this theme's default style (theme.json, settings.custom.prow): key => color.
 *
 * @return array<string, string>
 */
function windrose_prow_metis_own_custom(): array {
	$own = WP_Theme_JSON_Resolver::get_theme_data()->get_settings()['custom']['prow'] ?? array();
	return is_array( $own ) ? array_filter( $own, 'is_string' ) : array();
}

/**
 * Whether the site's saved style is another style than the default that brings no raised surface and no soft accents
 * of its own (a style made with Windrose Livery, for example): its palette differs from the default's in the
 * background or the accent, and it has no settings.custom.prow.
 *
 * @return bool
 */
function windrose_prow_metis_foreign_style(): bool {
	$user = WP_Theme_JSON_Resolver::get_user_data()->get_raw_data();
	if ( ! empty( $user['settings']['custom']['prow'] ) ) {
		return false;
	}
	$own = array();
	foreach ( (array) ( WP_Theme_JSON_Resolver::get_theme_data()->get_settings()['color']['palette']['theme'] ?? array() ) as $entry ) {
		$own[ (string) ( $entry['slug'] ?? '' ) ] = strtolower( (string) ( $entry['color'] ?? '' ) );
	}
	foreach ( (array) ( $user['settings']['color']['palette']['theme'] ?? array() ) as $entry ) {
		$slug = (string) ( $entry['slug'] ?? '' );
		if ( in_array( $slug, array( 'base', 'accent-1' ), true ) && strtolower( (string) ( $entry['color'] ?? '' ) ) !== ( $own[ $slug ] ?? '' ) ) {
			return true;
		}
	}
	return false;
}

add_action(
	'enqueue_block_assets',
	static function (): void {
		wp_register_style( 'windrose-prow-metis', false, array(), WINDROSE_PROW_METIS_VERSION );
		wp_enqueue_style( 'windrose-prow-metis' );
		wp_add_inline_style( 'windrose-prow-metis', windrose_prow_metis_css() );
	}
);

/**
 * Replaces Metis's function of this name (this file loads first and Metis checks function_exists): the colors of
 * Metis's Dark Mode switch are the site's style's other scheme, not the Cimmeria style's. Without twin colors, a
 * neutral dark set. The duotone is the color Metis paints its dark logos and icons with while the switch is on: the
 * other scheme's strong text color.
 *
 * @return array{palette: list<array{slug: string, color: string}>, duotone: list<array{slug: string, colors: list<string>}>}
 */
function metis_mode_toggle_colors() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Metis's own function name: this is how Metis lets a child replace it.
	$colors  = windrose_prow_metis_colors();
	$scheme  = windrose_prow_metis_other_scheme();
	$neutral = array(
		'base'     => '#0f1114',
		'contrast' => '#f5f5f5bf',
		'accent-1' => '#d9d9d9',
		'accent-3' => '#ffffff',
		'accent-5' => '#ffffff0d',
		'accent-6' => '#ffffff33',
	);
	$palette = array();
	foreach ( WINDROSE_PROW_METIS_COLORS as $slug ) {
		$color = '' === $scheme ? $neutral[ $slug ] : ( $colors[ "windrose-livery-$scheme-$slug" ] ?? '' );
		if ( '' !== $color ) {
			$palette[] = array(
				'slug'  => $slug,
				'color' => $color,
			);
		}
	}
	$ink = '' === $scheme ? $neutral['accent-3'] : ( $colors[ "windrose-livery-$scheme-accent-3" ] ?? '' );
	$ink = 1 === preg_match( '/^#[0-9a-f]{6}/i', $ink ) ? substr( $ink, 0, 7 ) : ( 'light' === $scheme ? '#000000' : '#ffffff' );
	return array(
		'palette' => $palette,
		'duotone' => array(
			array(
				'slug'   => 'duotone-2',
				'colors' => array( '#000000', $ink ),
			),
		),
	);
}
