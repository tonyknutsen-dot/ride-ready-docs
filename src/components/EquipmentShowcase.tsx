import { FerrisWheel, UtensilsCrossed, Store, Gamepad2, Sparkles } from "lucide-react";

const equipmentTypes = [
  { icon: FerrisWheel, label: "Rides" },
  { icon: UtensilsCrossed, label: "Food Kiosks" },
  { icon: Store, label: "Stalls" },
  { icon: Gamepad2, label: "Games" },
  { icon: Sparkles, label: "Attractions" },
];

const EquipmentShowcase = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-lg font-medium text-muted-foreground mb-8">
          Perfect for All Your Equipment
        </h3>
        <div className="flex flex-wrap justify-center gap-6 md:gap-10">
          {equipmentTypes.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-background border border-border/50 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 min-w-[100px]"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <item.icon className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EquipmentShowcase;
