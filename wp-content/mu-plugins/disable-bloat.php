<?php
/**
 * Plugin Name: Disable WordPress Bloat
 * Description: Remove unnecessary WordPress features for static site export
 * Version: 1.0
 * Author: Auto-generated
 */

// ========================================
// REMOVE WORDPRESS BLOAT
// ========================================

// Remove WordPress version from head
remove_action('wp_head', 'wp_generator');

// Remove WLW manifest
remove_action('wp_head', 'wlwmanifest_link');

// Remove RSD link (Really Simple Discovery - for external editing tools)
remove_action('wp_head', 'rsd_link');

// Remove shortlink
remove_action('wp_head', 'wp_shortlink_wp_head');

// Remove REST API links from head (not needed for static site)
remove_action('wp_head', 'rest_output_link_wp_head');
remove_action('wp_head', 'wp_oembed_add_discovery_links');
remove_action('template_redirect', 'rest_output_link_header', 11);

// Remove oEmbed JavaScript (for embedding content)
function disable_embeds_init() {
    // Remove the REST API endpoint
    remove_action('rest_api_init', 'wp_oembed_register_route');

    // Turn off oEmbed auto discovery
    add_filter('embed_oembed_discover', '__return_false');

    // Don't filter oEmbed results
    remove_filter('oembed_dataparse', 'wp_filter_oembed_result', 10);

    // Remove oEmbed discovery links
    remove_action('wp_head', 'wp_oembed_add_discovery_links');

    // Remove oEmbed-specific JavaScript from the front-end and back-end
    remove_action('wp_head', 'wp_oembed_add_host_js');
}
add_action('init', 'disable_embeds_init', 9999);

// Remove oEmbed script
function disable_embeds_script() {
    wp_deregister_script('wp-embed');
}
add_action('wp_footer', 'disable_embeds_script');

// Remove RSS feed links (unless you're using RSS feeds)
function disable_feed_links() {
    remove_action('wp_head', 'feed_links', 2);
    remove_action('wp_head', 'feed_links_extra', 3);
}
add_action('init', 'disable_feed_links');

// Disable XML-RPC (used for remote publishing - security risk too)
add_filter('xmlrpc_enabled', '__return_false');

// Remove DNS prefetch to s.w.org (WordPress.org)
function remove_dns_prefetch($hints, $relation_type) {
    if ('dns-prefetch' === $relation_type) {
        return array_diff(wp_dependencies_unique_hosts(), $hints);
    }
    return $hints;
}
add_filter('wp_resource_hints', 'remove_dns_prefetch', 10, 2);

// Disable jQuery Migrate (unless you need it for old plugins)
function remove_jquery_migrate($scripts) {
    if (!is_admin() && isset($scripts->registered['jquery'])) {
        $script = $scripts->registered['jquery'];
        if ($script->deps) {
            $script->deps = array_diff($script->deps, array('jquery-migrate'));
        }
    }
}
add_action('wp_default_scripts', 'remove_jquery_migrate');

// Remove global styles inline CSS (WordPress 5.9+ block theme styles)
// Only remove if you're using custom CSS and don't need WP's generated styles
function remove_global_styles() {
    remove_action('wp_enqueue_scripts', 'wp_enqueue_global_styles');
    remove_action('wp_body_open', 'wp_global_styles_render_svg_filters');
}
add_action('init', 'remove_global_styles');

// Remove duotone SVG filters (WordPress 5.9+)
remove_action('wp_body_open', 'wp_global_styles_render_svg_filters');

// Disable the block editor's frontend styles for classic themes
function disable_block_editor_styles() {
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('wp-block-library-theme');
    wp_dequeue_style('wc-blocks-style'); // WooCommerce if installed
}
// Uncomment the line below if you don't use Gutenberg blocks at all
// add_action('wp_enqueue_scripts', 'disable_block_editor_styles', 100);

