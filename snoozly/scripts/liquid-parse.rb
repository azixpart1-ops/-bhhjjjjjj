# Parse every .liquid file with Shopify's open-source Liquid in strict mode.
# Shopify's theme upload rejects the whole theme ("file contains Liquid
# templates that can't be parsed") without naming the file; this names it.
#   gem install liquid && ruby snoozly/scripts/liquid-parse.rb snoozly/theme
require 'liquid'
Warning[:deprecated] = false
class GenericBlock < Liquid::Block; end
class GenericTag < Liquid::Tag; end
class RawBlock < Liquid::Raw; end
# `{% render block %}` renders an app block. Shopify-only; the gem wants a string.
class ShopifyRender < Liquid::Render
  def initialize(tag_name, markup, options)
    markup.strip == 'block' ? Liquid::Tag.instance_method(:initialize).bind(self).call(tag_name, markup, options) : super
  end
  def render_to_output_buffer(_c, out) = out
end
env = Liquid::Environment.build do |e|
  %w[form paginate style stylesheet javascript].each { |t| e.register_tag(t, GenericBlock) }
  %w[section sections layout content_for].each { |t| e.register_tag(t, GenericTag) }
  e.register_tag('schema', RawBlock)
  e.register_tag('render', ShopifyRender)
end
root = ARGV[0] || File.expand_path('../theme', __dir__)
bad = 0
Dir.glob(File.join(root, '**/*.liquid')).sort.each do |f|
  Liquid::Template.parse(File.read(f, encoding: 'UTF-8'), environment: env, error_mode: :strict, line_numbers: true)
rescue => e
  bad += 1
  puts "#{f.sub(root + '/', '')}: #{e.message}"
end
puts bad.zero? ? 'PASS — every Liquid file parses in strict mode' : "FAIL — #{bad} file(s)"
exit(bad.zero? ? 0 : 1)
