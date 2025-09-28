-- Add comprehensive ride and stall categories
INSERT INTO public.ride_categories (name, description) VALUES
-- Traditional Fairground Rides
('Chair-o-Plane', 'Flying chair rides that swing passengers in circles'),
('Ferris Wheel', 'Large rotating wheel with passenger gondolas'),
('Carousel', 'Rotating platform with horses or other mounted figures'),
('Dodgems', 'Electric bumper cars in enclosed area'),
('Helter Skelter', 'Large spiral slide'),
('Big Wheel', 'Large observation wheel'),
('Waltzers', 'Spinning ride with individual cars that rotate'),
('Octopus', 'Multi-arm spinning ride'),
('Miami', 'Spinning ride with tilting cars'),
('Twist', 'Spinning ride with individual rotating cars'),
('Tagada', 'Bowl-shaped ride without seat belts'),
('Orbiter', 'High-speed spinning ride'),
('Enterprise', 'Vertical spinning wheel ride'),
('Rotor', 'Cylindrical spinning chamber'),
('Gravitron', 'Spinning cylinder ride'),
('Sizzler', 'Figure-8 spinning ride'),
('Tilt-a-Whirl', 'Spinning platform with free-spinning cars'),

-- Thrill Rides
('Roller Coaster', 'Tracked ride with hills and loops'),
('Drop Tower', 'Vertical drop ride'),
('Pirate Ship', 'Pendulum swinging ship'),
('Frisbee', 'Spinning disc on pendulum arm'),
('Booster', 'High-acceleration spinning ride'),
('Starflyer', 'High spinning chair ride'),
('Slingshot', 'Catapult-style thrill ride'),
('Bungee', 'Elastic cord jumping attraction'),
('Zipper', 'Revolving ferris wheel with spinning cars'),
('Ring of Fire', 'Complete 360-degree loop ride'),
('Kamikaze', 'Pendulum ride with spinning cars'),

-- Family Rides
('Tea Cups', 'Spinning cup ride suitable for families'),
('Mini Ferris Wheel', 'Smaller version of ferris wheel'),
('Train Ride', 'Miniature railway around track'),
('Convoy', 'Truck-themed children ride'),
('Helicopters', 'Spinning helicopter-themed ride'),
('Aeroplanes', 'Aircraft-themed spinning ride'),
('Fire Engine', 'Fire truck themed ride'),
('Balloons', 'Hot air balloon themed ride'),
('Jumping Castle', 'Inflatable bouncing attraction'),
('Slide', 'Various types of slides'),
('Fun House', 'Maze or obstacle course attraction'),

-- Water Rides
('Log Flume', 'Water ride with splash finale'),
('Rapids', 'White water rafting simulation'),
('Water Slide', 'Slide ending in water'),
('Splash Ride', 'Various water-based attractions'),

-- Dark Rides
('Ghost Train', 'Spooky indoor tracked ride'),
('Haunted House', 'Walk-through scary attraction'),
('Dark Ride', 'Indoor themed tracked attraction'),

-- Skill Games & Arcades
('Hook-a-Duck', 'Traditional fairground game'),
('Ring Toss', 'Ring throwing skill game'),
('Coconut Shy', 'Ball throwing at coconuts'),
('Test Your Strength', 'Hammer and bell strength game'),
('Shooting Gallery', 'Target shooting game'),
('Basketball Hoops', 'Basketball shooting game'),
('Darts', 'Traditional dart throwing game'),
('Arcade Games', 'Various electronic games'),
('Penny Arcade', 'Traditional coin-operated games'),

-- Food & Drink Stalls
('Fish & Chips', 'Traditional British takeaway stall'),
('Burger Van', 'Hamburger and fast food stall'),
('Hot Dog Stand', 'Hot dog and sausage stall'),
('Candy Floss', 'Cotton candy/candy floss stall'),
('Toffee Apple', 'Caramel apple stall'),
('Ice Cream Van', 'Ice cream and frozen treats'),
('Donut Stall', 'Fresh donut stand'),
('Pizza Stall', 'Pizza cooking and serving stall'),
('Tea & Coffee', 'Hot beverage stall'),
('Popcorn Stand', 'Fresh popcorn stall'),
('Crepe Stand', 'Pancake and crepe stall'),
('Jacket Potato', 'Baked potato stall'),
('Noodle Bar', 'Asian noodle cooking stall'),
('Sweet Stall', 'Traditional sweets and confectionery'),

-- Retail & Hoopla Stalls  
('Hoopla', 'Ring throwing game stall'),
('Tombola', 'Prize draw and raffle stall'),
('Toy Stall', 'Toy and gift merchandise'),
('Clothing Stall', 'Apparel and accessories'),
('Jewellery Stall', 'Costume jewellery and accessories'),
('Souvenir Stall', 'Event memorabilia and gifts'),
('Book Stall', 'Books and reading materials'),
('Craft Stall', 'Handmade crafts and art'),
('Plant Stall', 'Plants and gardening items'),
('Antique Stall', 'Vintage and antique items'),

-- Specialist Stalls
('Generator', 'Power generation equipment'),
('Toilet Block', 'Portable toilet facilities'),
('Information Stall', 'Event information and services'),
('First Aid', 'Medical assistance station'),
('Lost Property', 'Lost and found services'),
('Ticket Office', 'Event ticketing and entry')

ON CONFLICT (name) DO NOTHING;