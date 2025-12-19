import type { LiveChannel, Category } from '../types';

interface M3UChannel {
  name: string;
  logo: string;
  group: string;
  url: string;
  tvgId?: string;
  tvgName?: string;
}

export function parseM3U(content: string, filterLiveOnly = true): { channels: M3UChannel[]; categories: string[] } {
  const lines = content.split('\n');
  const channels: M3UChannel[] = [];
  const categoriesSet = new Set<string>();

  let currentChannel: Partial<M3UChannel> = {};

  // Keywords that indicate VOD/Series content (to filter out)
  const vodKeywords = ['/movie/', '/series/', 'VOD', '(FR-VO)', '(EN-VO)', '(AR-VO)', 'NETFLIX', 'AMAZON', 'DISNEY+', 'APPLE TV'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Parse channel info
      const info = line.substring(8);
      
      // Extract attributes using regex
      const tvgIdMatch = info.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = info.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = info.match(/tvg-logo="([^"]*)"/i);
      // Handle both formats: group-title="..." and group-title=...
      const groupMatch = info.match(/group-title="([^"]*)"/i) || info.match(/group-title=([^,\s]+)/i);
      
      // Extract name (after the last comma)
      const nameMatch = info.match(/,\s*(.+)$/);

      const group = groupMatch?.[1]?.trim() || 'Autres';
      
      currentChannel = {
        tvgId: tvgIdMatch?.[1] || '',
        tvgName: tvgNameMatch?.[1] || '',
        logo: tvgLogoMatch?.[1] || '',
        group: group,
        name: nameMatch?.[1]?.trim() || 'Unknown Channel',
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      // This is the URL line
      currentChannel.url = line;
      
      // Filter: only keep live channels if filterLiveOnly is true
      const isVod = filterLiveOnly && vodKeywords.some(kw => 
        line.includes(kw) || (currentChannel.group?.toUpperCase().includes(kw))
      );
      
      if (!isVod) {
        channels.push(currentChannel as M3UChannel);
        if (currentChannel.group) {
          categoriesSet.add(currentChannel.group);
        }
      }
      
      currentChannel = {};
    }
  }

  console.log('Parsed M3U:', channels.length, 'live channels,', categoriesSet.size, 'categories');
  console.log('Sample categories:', Array.from(categoriesSet).slice(0, 10));

  return {
    channels,
    categories: Array.from(categoriesSet).sort(),
  };
}

export function m3uToLiveChannels(m3uChannels: M3UChannel[]): LiveChannel[] {
  return m3uChannels.map((channel, index) => ({
    num: index + 1,
    name: channel.name,
    stream_type: 'live',
    stream_id: index + 1,
    stream_icon: channel.logo,
    epg_channel_id: channel.tvgId || null,
    added: new Date().toISOString(),
    category_id: channel.group,
    custom_sid: '',
    tv_archive: 0,
    direct_source: channel.url,
    tv_archive_duration: 0,
  }));
}

export function m3uToCategories(categoryNames: string[]): Category[] {
  return categoryNames.map((name, index) => ({
    category_id: name,
    category_name: name,
    parent_id: 0,
  }));
}

export async function loadM3UFromUrl(url: string): Promise<{ channels: LiveChannel[]; categories: Category[] }> {
  try {
    const response = await fetch(url);
    const content = await response.text();
    const { channels, categories } = parseM3U(content);
    
    return {
      channels: m3uToLiveChannels(channels),
      categories: m3uToCategories(categories),
    };
  } catch (error) {
    console.error('Error loading M3U:', error);
    throw new Error('Failed to load M3U playlist');
  }
}

export async function loadM3UFromFile(file: File): Promise<{ channels: LiveChannel[]; categories: Category[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const { channels, categories } = parseM3U(content);
        
        resolve({
          channels: m3uToLiveChannels(channels),
          categories: m3uToCategories(categories),
        });
      } catch (error) {
        reject(new Error('Failed to parse M3U file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
