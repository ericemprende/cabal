-- Donaciones voluntarias con puntos.
--
-- El botón de donar abría un widget de NOWPayments dentro de un iframe: se
-- pagaba y ahí acababa todo, sin que el servidor supiera nunca que alguien
-- había donado ni cuánto. Ahora la donación es una factura nuestra (order_id =
-- Payment.id, plan 'donation'), así que la notificación del proveedor nos dice
-- el importe confirmado y con eso se abonan los puntos.
--
-- Esta tabla es el recibo de la donación ya cobrada: paymentId es único, igual
-- que en Subscription y AmmoEntry, y es lo que hace que una notificación
-- repetida no pague dos veces los mismos puntos. Guarda también si la persona
-- cobró el bonus por publicar su tarjeta en X (una vez por donación).

CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "sharedAt" TIMESTAMP(3),
    "sharePoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Donation_paymentId_key" ON "Donation"("paymentId");

CREATE INDEX "Donation_userId_createdAt_idx" ON "Donation"("userId", "createdAt");

ALTER TABLE "Donation" ADD CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
