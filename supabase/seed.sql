-- Seed catalog data. Safe to re-run. Prices are placeholders (see DECISIONS.md).
-- Coupon codes are inserted into reward_codes, which clients cannot read.

insert into public.plans (id, name, tagline, price_inr, rank, highlight, daily_matches, music, priority_matching, reward_tier, perks)
values
  ('plus', 'Plus', 'Start sharing tables', 199, 1, false, 5, false, false, 1,
    array['Core food + tone matching', 'Profile and basic avatar', 'Post and view stories', 'Starter streak rewards']),
  ('premium', 'Premium', 'For regular foodies', 499, 2, true, 20, true, false, 2,
    array['Everything in Plus', 'Premium music library in calls', '20 matches a day', 'Extended streak rewards']),
  ('ultra', 'Ultra', 'The whole menu', 999, 3, false, null, true, true, 3,
    array['Everything in Premium', 'Priority matching', 'Exclusive avatar items', 'Hotel-tier sponsor rewards', 'Streak freeze (coming soon)'])
on conflict (id) do update set
  price_inr = excluded.price_inr,
  perks = excluded.perks,
  daily_matches = excluded.daily_matches,
  highlight = excluded.highlight;

insert into public.music_tracks (id, title, mood, preset) values
  ('moonlit-keys', 'Moonlit Keys', 'Piano', 'piano'),
  ('velvet-strings', 'Velvet Strings', 'Violin', 'violin'),
  ('slow-sunday', 'Slow Sunday', 'Soft instrumental', 'soft'),
  ('corner-cafe', 'Corner Cafe', 'Cafe ambience', 'cafe')
on conflict (id) do nothing;

insert into public.sponsors (id, name, kind, city) values
  ('sp-brewhouse', 'Third Wave Brewhouse', 'cafe', 'Bengaluru'),
  ('sp-spice', 'Spice Route Kitchen', 'restaurant', 'Bengaluru'),
  ('sp-tajview', 'The Grand Terrace Hotel', 'hotel', 'Mumbai'),
  ('sp-momo', 'Momo Republic', 'restaurant', 'Delhi')
on conflict (id) do nothing;

insert into public.rewards (id, sponsor_id, title, description, min_streak, min_plan, expires_at, stock) values
  ('r1', 'sp-brewhouse', 'Free cappuccino', 'One free regular cappuccino with any food order.', 3, 'plus', '2026-12-31', 120),
  ('r2', 'sp-momo', '20% off momo platter', 'Valid on dine-in for two.', 7, 'plus', '2026-12-31', 60),
  ('r3', 'sp-spice', '₹500 off dinner for two', 'Minimum bill ₹1,500.', 15, 'premium', '2026-12-31', 25),
  ('r4', 'sp-tajview', 'Weekend brunch for two', 'Complimentary brunch at the rooftop terrace.', 30, 'ultra', '2026-12-31', 5)
on conflict (id) do nothing;

-- Dummy codes so the server-only table is exercised. Not valid at any sponsor.
insert into public.reward_codes (reward_id, code) values
  ('r1', 'PHASE6-DEMO-NOT-A-REAL-CODE')
on conflict (reward_id, code) do nothing;

insert into public.avatar_items (category, id, label, price_inr, unlock_type, unlock_value) values
  ('skin', 's1', 'Tone 1', 0, null, null),
  ('skin', 's2', 'Tone 2', 0, null, null),
  ('skin', 's3', 'Tone 3', 0, null, null),
  ('skin', 's4', 'Tone 4', 0, null, null),
  ('skin', 's5', 'Tone 5', 0, null, null),
  ('hair', 'short', 'Short', 0, null, null),
  ('hair', 'long', 'Long', 0, null, null),
  ('hair', 'bun', 'Bun', 0, null, null),
  ('hair', 'curly', 'Curly', 49, null, null),
  ('hair', 'mohawk', 'Mohawk', 79, null, null),
  ('hair', 'none', 'Bald', 0, null, null),
  ('hairColor', 'black', 'Black', 0, null, null),
  ('hairColor', 'brown', 'Brown', 0, null, null),
  ('hairColor', 'blonde', 'Blonde', 0, null, null),
  ('hairColor', 'pink', 'Pink', 29, null, null),
  ('hairColor', 'peach', 'Nagrek peach', 0, 'streak', '7'),
  ('hairColor', 'blue', 'Electric blue', 29, null, null),
  ('outfit', 'tee', 'Tee', 0, null, null),
  ('outfit', 'hoodie', 'Hoodie', 0, null, null),
  ('outfit', 'kurta', 'Kurta', 59, null, null),
  ('outfit', 'jacket', 'Jacket', 99, null, null),
  ('outfit', 'chef', 'Chef coat', 0, 'streak', '15'),
  ('outfit', 'neon', 'Neon fit', 0, 'plan', 'ultra'),
  ('accessory', 'none', 'None', 0, null, null),
  ('accessory', 'glasses', 'Glasses', 0, null, null),
  ('accessory', 'shades', 'Shades', 39, null, null),
  ('accessory', 'cap', 'Cap', 49, null, null),
  ('accessory', 'headphones', 'Headphones', 69, null, null),
  ('accessory', 'crown', 'Crown', 0, 'streak', '30'),
  ('background', 'peach', 'Peach', 0, null, null),
  ('background', 'night', 'Night', 0, null, null),
  ('background', 'mint', 'Mint', 19, null, null),
  ('background', 'sunset', 'Sunset', 19, null, null),
  ('background', 'galaxy', 'Galaxy', 0, 'plan', 'ultra')
on conflict (category, id) do nothing;
