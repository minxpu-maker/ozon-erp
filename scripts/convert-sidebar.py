#!/usr/bin/env python3
"""Convert pages with custom sidebar to use AppLayout."""

import re
import os

# Pages that need full sidebar conversion
FULL_SIDEBAR_PAGES = [
    'src/app/purchase/page.tsx',
    'src/app/quick-entry/page.tsx',
    'src/app/logistics/page.tsx',
    'src/app/packaging/page.tsx',
    'src/app/inventory/page.tsx',
    'src/app/suppliers/page.tsx',
    'src/app/reports/page.tsx',
    'src/app/finance/page.tsx',
    'src/app/accounts/page.tsx',
    'src/app/roles/page.tsx',
    'src/app/wms/page.tsx',
    'src/app/sku-management/page.tsx',
]

# Simple p-6 pages
SIMPLE_PAGES = [
    ('src/app/orders/list/page.tsx', '订单列表', '管理来自 Ozon 的 FBS 订单'),
    ('src/app/settings/shops/page.tsx', '店铺管理', '管理Ozon店铺账号'),
    ('src/app/settings/devices/page.tsx', '设备管理', '管理扫描枪、电子秤等设备'),
    ('src/app/data/page.tsx', '数据中心', '数据来源与健康监控'),
]

def get_title_from_header(content: str) -> tuple[str, str]:
    """Extract page title and subtitle from header element."""
    # Match: <h1 className="...">采购管理</h1>
    m = re.search(r'<h1[^>]*>([^<]+)</h1>', content)
    title = m.group(1).strip() if m else ''
    return title, ''

def convert_full_sidebar_page(filepath: str) -> bool:
    """Convert a page with full custom sidebar to AppLayout."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Find the return statement start
    return_match = re.search(r'\n  return \(', content)
    if not return_match:
        print(f"  No return() found in {filepath}")
        return False

    # Check if already has AppLayout
    if 'AppLayout' in content[:return_match.start() + 500]:
        print(f"  Already has AppLayout in {filepath}")
        return True

    # Find the opening div after return (
    # Pattern: <div className="min-h-screen bg-[#F6F8FB] flex">
    open_div_match = re.search(r'\n    <div className="min-h-screen bg-\[#F6F8FB\] flex">', content)
    if not open_div_match:
        print(f"  No min-h-screen div found in {filepath}")
        return False

    # Find the closing structure: </main> + </div> + </div>
    # Count indentation: 4 spaces = main content indent
    main_close = re.search(r'\n      </main>', content)
    if not main_close:
        print(f"  No </main> found in {filepath}")
        return False

    # Find the two </div> that close the wrappers
    # They should be right after </main>
    after_main = content[main_close.end():]
    # Match two </div> at the same indentation level as </main>
    m = re.search(r'\n      </div>\n      </div>', after_main)
    if not m:
        # Try different indentation
        m = re.search(r'\n      </div>\n    </div>', after_main)

    # Find where the sidebar <aside> ends
    sidebar_close = None
    # The sidebar is the first <aside> after the opening div
    sidebar_start = re.search(r'\n      <aside[^>]*>', content[open_div_match.start():])
    if sidebar_start:
        # Find closing </aside> - usually indented with 6 spaces
        aside_end = re.search(r'\n      </aside>', content[open_div_match.start():])
        if aside_end:
            sidebar_close = open_div_match.start() + aside_end.end()

    # Find the flex-1 div start and end
    flex_div_start = re.search(r'\n      <div className="flex-1 ml-56 flex flex-col">', content)
    header_start = re.search(r'\n        <header[^>]*>', content)
    header_end = re.search(r'\n        </header>', content)
    flex_div_end = re.search(r'\n      </div>\n      </main>', content)

    if not all([open_div_match, main_close, flex_div_start, header_start, header_end]):
        print(f"  Could not find all required elements in {filepath}")
        return False

    # Extract page title from header
    title_m = re.search(r'<h1[^>]*>([^<]+)</h1>', content[header_start.start():header_end.end()])
    title = title_m.group(1).strip() if title_m else os.path.basename(os.path.dirname(filepath))

    # Extract the content between header and </main>
    content_start = header_end.end()
    content_end = main_close.start()
    page_content = content[content_start:content_end].rstrip('\n')

    # Extract Dialog content after </main>
    dialog_content = ''
    after_main_text = content[main_close.start():]
    # Find the next </div> that closes the outer wrapper
    # Usually it looks like: </main>\n      </div>\n    </div>\n  );
    m2 = re.search(r'\n      </div>\n    </div>\n  \);', after_main_text)
    if m2:
        dialog_content = after_main_text[len(m2.group()):]
        # Remove the trailing closing divs that we included
        # Actually we need to keep the dialog content

    # Actually let me re-think this. The structure after </main> is:
    # </main>
    # </div>  ← closing of flex-1 div
    # </div>  ← closing of min-h-screen div
    # );
    # But there may be more content (Dialogs) after </main>

    # Let me look at the actual content
    tail = content[main_close.start():]
    print(f"  Content after </main> (first 100 chars): {repr(tail[:100])}")

    return False  # Skip for now, need more analysis

def convert_simple_page(filepath: str, title: str, subtitle: str) -> bool:
    """Convert a simple p-6 page to use AppLayout."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Check if already has AppLayout
    if "'@/components/layout/AppLayout'" in content or '"@/components/layout/AppLayout"' in content:
        print(f"  Already has AppLayout in {filepath}")
        return True

    # Find return statement
    return_match = re.search(r'\n  return \(', content)
    if not return_match:
        return False

    # Find opening div
    open_div = re.search(r'\n    <div className="p-6([^"]*)">', content[return_match.start():])
    if not open_div:
        return False

    div_start = return_match.start() + open_div.start()
    div_end_match = re.search(r'\n    </div>\n  \);', content[div_start:])
    if not div_end_match:
        return False

    div_end = div_start + div_end_match.start()
    inner = content[div_start + open_div.end():div_end].rstrip('\n')

    new_page = (
        content[:return_match.start()] +
        '\n  return (\n    <AppLayout title="' + title + '" subtitle="' + subtitle + '">\n' +
        inner +
        '\n    </AppLayout>\n  );\n}'
    )

    if new_page != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_page)
        print(f"  Converted {filepath}")
        return True
    return False

# Main
if __name__ == '__main__':
    print("Converting simple pages...")
    for filepath, title, subtitle in SIMPLE_PAGES:
        convert_simple_page(filepath, title, subtitle)

    print("\nFull sidebar pages need manual conversion:")
    for p in FULL_SIDEBAR_PAGES:
        print(f"  {p}")
