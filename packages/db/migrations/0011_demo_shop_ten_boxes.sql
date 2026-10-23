-- The demo shop on the live site, and only it.
--
-- 0010 deliberately left existing shops where they were: a shop that told its
-- customers "ten stamps" is still telling them that, and the number they
-- promised is not ours to quietly move. But the seeded demo promised nothing
-- to anybody, and with a prize box on the end it was reading "Buy 10, get the
-- 11th free" across an eleven-box card — which is the one thing no shop
-- prints, on the page we show people first.
--
-- Scoped by slug so it can never reach a real shop, and written to do nothing
-- if the demo has since been edited by hand.
update programs p
   set stamps_required = 9
  from companies c
 where c.id = p.company_id
   and c.slug = 'bubble-tea-co'
   and p.stamps_required = 10
   and p.reward_in_grid;
