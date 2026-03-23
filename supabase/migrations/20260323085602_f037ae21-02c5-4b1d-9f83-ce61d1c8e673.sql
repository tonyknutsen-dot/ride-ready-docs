ALTER TABLE profiles DROP CONSTRAINT profiles_subscription_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_plan_check CHECK (
  subscription_plan IS NULL OR subscription_plan = ANY (ARRAY['basic','advanced','starter','operator','professional','business','enterprise'])
);