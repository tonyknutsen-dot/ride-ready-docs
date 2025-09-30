-- Add foreign key constraint from inspection_schedules to rides
ALTER TABLE inspection_schedules
ADD CONSTRAINT fk_inspection_schedules_ride
FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE;