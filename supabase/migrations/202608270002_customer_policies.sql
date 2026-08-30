create policy read_own_profile on public.profiles for select to authenticated
using ((select auth.uid())=id);

create policy update_own_profile on public.profiles for update to authenticated
using ((select auth.uid())=id) with check ((select auth.uid())=id);

create policy read_own_orders on public.orders for select to authenticated
using ((select auth.uid())=user_id);

create policy read_own_items on public.order_items for select to authenticated
using (exists(select 1 from public.orders where orders.id=order_items.order_id and orders.user_id=(select auth.uid())));
