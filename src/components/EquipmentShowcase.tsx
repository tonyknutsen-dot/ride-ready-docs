import { FerrisWheel, UtensilsCrossed, Gamepad2, Wind, Zap, Store, Sparkles } from "lucide-react";

const equipmentTypes = [
  { icon: FerrisWheel, label: "Rides" },
  { icon: UtensilsCrossed, label: "Food Stalls" },
  { icon: Store, label: "Stalls" },
  { icon: Gamepad2, label: "Games" },
  { icon: Wind, label: "Inflatables" },
  { icon: Sparkles, label: "Attractions" },
  { icon: Zap, label: "Equipment" },
];

const EquipmentShowcase = () => {
  return (
    <section className="py-16 bg-gradient-to-r from-secondary via-primary/5 to-accent/5">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-lg font-medium text-muted-foreground mb-8">
          Perfect for All Your Equipment
        </h3>
        <div className="flex flex-wrap justify-center gap-6 md:gap-10">
          {equipmentTypes.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border-2 border-primary/20 shadow-card hover:shadow-elegant hover:scale-105 hover:border-primary/40 transition-all duration-200 min-w-[100px]"
            >
              <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
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
