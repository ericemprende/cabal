import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Botones de Cabal. La forma —el chaflán de las esquinas— sale de la chapa de
 * las insignias, y vive en `.btn-cabal` (globals.css) junto con el hover, que
 * aclara el color en vez de cambiarlo.
 *
 * Seis variantes y ninguna más:
 *   default      la acción principal. Una por pantalla.
 *   secondary    acción real que no es la principal, y el estado ya conseguido
 *                (Seguir pasa a secundario cuando ya sigues). `outline` es su
 *                alias: se mantiene porque medio código lo usa.
 *   ghost        salir sin hacer nada.
 *   destructive  deshace o borra. El mismo rojo que "en vivo".
 *   dinero       mueve fondos de verdad: lleva el importe dentro y confirma.
 *   donar        hueso sólido, la única pieza clara de la interfaz. Nunca dos
 *                en la misma pantalla: funciona porque es rara.
 */
const buttonVariants = cva(
  "btn-cabal inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "btn-relieve bg-gradient-to-b from-[#9dba46] to-primary text-primary-foreground",
        destructive: "btn-contorno [--btn-borde:rgb(255_77_94/0.45)] bg-[#ff4d5e]/10 text-[#ff8080]",
        outline: "btn-contorno bg-[#171a13] text-foreground",
        secondary: "btn-contorno bg-[#171a13] text-foreground",
        ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        dinero: "btn-relieve bg-gradient-to-b from-[#9dba46] to-[#7d9435] text-primary-foreground",
        donar: "btn-relieve bg-gradient-to-b from-white to-[#e8ebe0] text-[#0a0b08]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] has-[>svg]:px-4",
        sm: "btn-sm h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "btn-lg h-12 px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
